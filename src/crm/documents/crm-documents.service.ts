import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Request } from "express";
import type { DocumentKind, Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "../../staff/staff-audit.service";
import { MAX_PHOTO_BYTES, normalizePhoto } from "../../storage/normalize-image";
import { ObjectStorageService } from "../../storage/object-storage.service";
import { formatVehicleLabel } from "../common/crm-format.util";
import type { MissingField } from "../inspection/inspection-readiness";
import { CrmInspectionService } from "../inspection/crm-inspection.service";
import { agreedOnly, computeActual, computePricing } from "../services/pricing";
import { itemTitle, type Selections } from "../services/services.rules";
import { documentMissing, type DocumentReadinessInput } from "./document-readiness";
import {
  DOCUMENT_KINDS,
  DOCUMENT_LABELS,
  SNAPSHOT_SCHEMA_VERSION,
  buildIssuer,
  formatDocNumber,
  type IssuerSnapshot,
} from "./document.rules";

type InspectionView = Awaited<ReturnType<CrmInspectionService["get"]>>;

/** Всё, что нужно для рендера документа. Рендер зависит только от снимка, не от текущих данных карточки. */
export type DocumentSnapshot = {
  schemaVersion: number;
  kind: DocumentKind;
  number: string | null;
  docDate: string | null;
  formedAt: string;
  /** Предпросмотр: документ ещё не сформирован (или в нём не хватает данных). */
  draft: boolean;
  missing: MissingField[];
  issuer: IssuerSnapshot;
  client: { id: number; lastName: string | null; firstName: string | null; patronymic: string | null; phone: string; birthDate: string | null };
  vehicle: { id: number; label: string; year: number | null; vin: string | null; plate: string | null } | null;
  visit: { id: number; startsAt: string | null; endsAt: string | null; serviceType: string; priceRub: number | null; completedAt: string | null; location: string };
  inspection: InspectionView | null;
  /** Согласованные работы: название, комментарий, цена (null — не определена). */
  works: { id: number; categoryName: string; title: string; comment: string | null; priceRub: number | null }[];
  /** Стоимость в рублях: предварительная, скидка, согласованный итог, оплата, остаток. */
  pricing: {
    preliminary: number | null;
    discountPercent: number | null;
    discountRub: number;
    agreedTotal: number | null;
    paidRub: number;
    remaining: number | null;
    paymentMethod: string | null;
  };
  /** Фактическое выполнение (для акта выполненных работ). */
  execution: unknown;
  handover: unknown;
  /** Дата акта приёма-передачи — на неё ссылается акт выполненных работ. */
  acceptanceDate: string | null;
};

const visitInclude = {
  user: { select: { id: true, phone: true, lastName: true, firstName: true, patronymic: true, birthDate: true } },
  vehicle: { include: { car: { select: { model: true, brand: { select: { name: true } } } } } },
  inspection: { include: { marks: { select: { id: true } } } },
  workItems: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      category: { include: { groups: true } },
      master: { select: { id: true, fullName: true } },
      photos: { select: { stage: true } },
    },
  },
  handover: { include: { issuedBy: { select: { id: true, fullName: true } } } },
  documents: {
    include: { versions: { orderBy: { version: "desc" } } },
  },
} satisfies Prisma.VisitHistoryInclude;

type VisitCtx = Prisma.VisitHistoryGetPayload<{ include: typeof visitInclude }>;
type VersionRow = VisitCtx["documents"][number]["versions"][number];

@Injectable()
export class CrmDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly audit: StaffAuditService,
    private readonly inspection: CrmInspectionService,
  ) {}

  /** Состояние всех трёх документов записи: статус, недостающее, версии. */
  async list(visitId: number) {
    const ctx = await this.load(visitId);
    return {
      visitId,
      number: ctx.docNumber,
      docDate: ctx.docDate,
      location: ctx.location,
      documents: DOCUMENT_KINDS.map((kind) => this.state(ctx, kind)),
    };
  }

  /** Предпросмотр черновика: ничего не сохраняет и не расходует номер. */
  async draft(visitId: number, kind: DocumentKind): Promise<DocumentSnapshot> {
    const ctx = await this.load(visitId);
    const [branch, org, inspection] = await Promise.all([
      this.prisma.branch.findUniqueOrThrow({ where: { location: ctx.location } }),
      this.prisma.organization.findUniqueOrThrow({ where: { id: 1 } }),
      this.inspectionFor(ctx),
    ]);
    return this.buildSnapshot(ctx, kind, {
      draft: true,
      missing: this.missingFor(ctx, kind),
      number: ctx.docNumber,
      docDate: ctx.docDate,
      inspection,
      issuer: buildIssuer(org, branch),
    });
  }

  /** Формирует окончательную версию. Первое формирование выдаёт единый номер договора и актов. */
  async form(visitId: number, kind: DocumentKind, correction: boolean, req: Request) {
    const ctx = await this.load(visitId);
    const missing = this.missingFor(ctx, kind);
    if (missing.length > 0) {
      throw new BadRequestException({
        message: `Нельзя сформировать «${DOCUMENT_LABELS[kind]}»: не заполнено ${missing.length}`,
        missing,
      });
    }
    const current = this.currentVersion(ctx, kind);
    if (current?.status === "SIGNED" && !correction) {
      throw new ConflictException("Документ подписан и не меняется. Чтобы исправить, создайте новую версию");
    }
    const [branch, org, inspection] = await Promise.all([
      this.prisma.branch.findUniqueOrThrow({ where: { location: ctx.location } }),
      this.prisma.organization.findUniqueOrThrow({ where: { id: 1 } }),
      this.inspectionFor(ctx),
    ]);
    const actor = adminActor(req);

    const version = await this.prisma.$transaction(async (tx) => {
      // Блокируем запись: два одновременных формирования не выдадут два разных номера
      const [locked] = await tx.$queryRaw<{ docNumber: string | null; docDate: Date | null }[]>`
        SELECT "docNumber", "docDate" FROM visit_history WHERE id = ${visitId} FOR UPDATE`;
      let number = locked?.docNumber ?? null;
      let docDate = locked?.docDate ?? null;
      if (!number) {
        const [{ lastSeq }] = await tx.$queryRaw<{ lastSeq: number }[]>`
          INSERT INTO document_counters (prefix, "lastSeq") VALUES (${branch.docPrefix}, 1)
          ON CONFLICT (prefix) DO UPDATE SET "lastSeq" = document_counters."lastSeq" + 1
          RETURNING "lastSeq"`;
        number = formatDocNumber(branch.docPrefix, lastSeq);
        docDate = new Date();
        await tx.visitHistory.update({ where: { id: visitId }, data: { docNumber: number, docDate } });
      }

      const doc = await tx.document.upsert({
        where: { visitId_kind: { visitId, kind } },
        create: { visitId, kind },
        update: {},
        include: { versions: { select: { version: true } } },
      });
      const next = Math.max(0, ...doc.versions.map((v) => v.version)) + 1;
      // Неподписанная прошлая версия заменяется; подписанная остаётся как есть до подписания новой
      await tx.documentVersion.updateMany({
        where: { documentId: doc.id, status: "READY" },
        data: { status: "VOID", voidedAt: new Date(), voidedBy: actor, voidReason: `Заменён версией ${next}` },
      });

      const snapshot = this.buildSnapshot(ctx, kind, {
        draft: false,
        missing: [],
        number,
        docDate,
        inspection,
        issuer: buildIssuer(org, branch),
      });
      return tx.documentVersion.create({
        data: {
          documentId: doc.id,
          version: next,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          formedBy: actor,
        },
      });
    });

    await this.audit.log({
      action: StaffAuditAction.DOCUMENT_FORMED,
      actor,
      req,
      meta: { visitId, kind, version: version.version, correction },
    });
    return this.list(visitId);
  }

  /** Снимок конкретной версии — по нему клиент рисует PDF/DOCX, в том числе спустя годы. */
  async getVersion(visitId: number, versionId: number) {
    const v = await this.findVersion(visitId, versionId);
    return { ...this.presentVersion(v), snapshot: v.snapshot as unknown as DocumentSnapshot };
  }

  /** «Отметить подписание»: версия становится неизменной; скан подписанного необязателен, но рекомендуется. */
  async sign(visitId: number, versionId: number, file: Express.Multer.File | undefined, req: Request) {
    const v = await this.findVersion(visitId, versionId);
    if (v.status !== "READY") throw new ConflictException("Подписать можно только версию, готовую к подписанию");
    const actor = adminActor(req);
    const scanKey = file?.buffer?.length ? await this.storeScan(visitId, file) : null;
    try {
      await this.prisma.$transaction([
        this.prisma.documentVersion.update({
          where: { id: versionId },
          data: { status: "SIGNED", signedAt: new Date(), signedBy: actor, scanKey },
        }),
        // Раньше подписанная версия того же документа заменена этой
        this.prisma.documentVersion.updateMany({
          where: { documentId: v.documentId, status: "SIGNED", NOT: { id: versionId } },
          data: { status: "VOID", voidedAt: new Date(), voidedBy: actor, voidReason: `Заменён подписанной версией ${v.version}` },
        }),
      ]);
    } catch (e) {
      if (scanKey) await this.storage.remove(scanKey); // не оставляем сиротский файл
      throw e;
    }
    await this.audit.log({ action: StaffAuditAction.DOCUMENT_SIGNED, actor, req, meta: { visitId, versionId, scan: scanKey !== null } });
    return this.list(visitId);
  }

  /** Аннулировать можно только неподписанную версию; подписанную исправляют новой версией. */
  async voidVersion(visitId: number, versionId: number, reason: string, req: Request) {
    const v = await this.findVersion(visitId, versionId);
    if (v.status !== "READY") throw new ConflictException("Аннулировать можно только версию, не подписанную клиентом");
    const actor = adminActor(req);
    await this.prisma.documentVersion.update({
      where: { id: versionId },
      data: { status: "VOID", voidedAt: new Date(), voidedBy: actor, voidReason: reason.trim() },
    });
    await this.audit.log({ action: StaffAuditAction.DOCUMENT_VOIDED, actor, req, meta: { visitId, versionId } });
    return this.list(visitId);
  }

  // ---------------------------------------------------------------------------------------------

  private state(ctx: VisitCtx, kind: DocumentKind) {
    const doc = ctx.documents.find((d) => d.kind === kind);
    const current = this.currentVersion(ctx, kind);
    const missing = this.missingFor(ctx, kind);
    return {
      kind,
      label: DOCUMENT_LABELS[kind],
      status: current ? current.status : missing.length > 0 ? ("INSUFFICIENT_DATA" as const) : ("NOT_FORMED" as const),
      missing,
      currentVersionId: current?.id ?? null,
      versions: (doc?.versions ?? []).map((v) => this.presentVersion(v)),
    };
  }

  private presentVersion(v: VersionRow) {
    return {
      id: v.id,
      version: v.version,
      status: v.status,
      formedAt: v.formedAt,
      formedBy: v.formedBy,
      signedAt: v.signedAt,
      signedBy: v.signedBy,
      scanUrl: v.scanKey ? this.storage.publicUrl(v.scanKey) : null,
      voidedAt: v.voidedAt,
      voidReason: v.voidReason,
    };
  }

  /** Действующая версия: самая новая из не аннулированных. */
  private currentVersion(ctx: VisitCtx, kind: DocumentKind): VersionRow | undefined {
    return ctx.documents.find((d) => d.kind === kind)?.versions.find((v) => v.status !== "VOID");
  }

  private missingFor(ctx: VisitCtx, kind: DocumentKind): MissingField[] {
    const input: DocumentReadinessInput = {
      client: ctx.user,
      vehicle: ctx.vehicle,
      inspection: ctx.inspection,
      marksCount: ctx.inspection?.marks.length ?? 0,
      visit: ctx,
      execution: this.executionOf(ctx),
      worksCount: agreedOnly(ctx.workItems).length,
      preliminaryPrice: this.pricingOf(ctx).preliminary,
      has: { CONTRACT: !!this.currentVersion(ctx, "CONTRACT"), ACCEPTANCE: !!this.currentVersion(ctx, "ACCEPTANCE") },
    };
    return documentMissing(kind, input);
  }

  private actualOf(ctx: VisitCtx) {
    return computeActual({
      items: ctx.workItems,
      discountPercent: ctx.discountPercent,
      discountRub: ctx.discountRub,
      paidRub: ctx.paidRub,
    });
  }

  private titleOf(i: VisitCtx["workItems"][number]) {
    return itemTitle(i.category, i.selections as unknown as Selections);
  }

  private executionOf(ctx: VisitCtx): DocumentReadinessInput["execution"] {
    return {
      agreed: agreedOnly(ctx.workItems).map((i) => ({ title: this.titleOf(i), status: i.status })),
      extras: ctx.workItems
        .filter((i) => i.kind === "EXTRA")
        .map((i) => ({ title: this.titleOf(i), status: i.status, approvalStatus: i.approvalStatus })),
      actualTotal: this.actualOf(ctx).total,
      handover: ctx.handover,
    };
  }

  private pricingOf(ctx: VisitCtx) {
    return computePricing({
      items: agreedOnly(ctx.workItems),
      fallbackPriceRub: ctx.priceRub,
      discountPercent: ctx.discountPercent,
      discountRub: ctx.discountRub,
      paidRub: ctx.paidRub,
    });
  }

  private inspectionFor(ctx: VisitCtx): Promise<InspectionView | null> {
    return ctx.inspection ? this.inspection.get(ctx.id) : Promise.resolve(null);
  }

  private buildSnapshot(
    ctx: VisitCtx,
    kind: DocumentKind,
    opts: {
      draft: boolean;
      missing: MissingField[];
      number: string | null;
      docDate: Date | null;
      inspection: InspectionView | null;
      issuer: IssuerSnapshot;
    },
  ): DocumentSnapshot {
    const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
    return JSON.parse(
      JSON.stringify({
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        kind,
        number: opts.number,
        docDate: iso(opts.docDate),
        formedAt: new Date().toISOString(),
        draft: opts.draft,
        missing: opts.missing,
        issuer: opts.issuer,
        client: {
          id: ctx.user.id,
          lastName: ctx.user.lastName,
          firstName: ctx.user.firstName,
          patronymic: ctx.user.patronymic,
          phone: ctx.user.phone,
          birthDate: iso(ctx.user.birthDate),
        },
        vehicle: ctx.vehicle && {
          id: ctx.vehicle.id,
          label: formatVehicleLabel(ctx.vehicle),
          year: ctx.vehicle.year,
          vin: ctx.vehicle.vin,
          plate: ctx.vehicle.plate,
        },
        visit: {
          id: ctx.id,
          startsAt: iso(ctx.startsAt),
          endsAt: iso(ctx.endsAt),
          serviceType: ctx.serviceType,
          priceRub: ctx.priceRub,
          completedAt: iso(ctx.completedAt),
          location: ctx.location,
        },
        inspection: opts.inspection,
        works: agreedOnly(ctx.workItems).map((i) => ({
          id: i.id,
          categoryName: i.category.name,
          title: itemTitle(i.category, i.selections as unknown as Selections),
          comment: i.comment,
          priceRub: i.priceRub,
        })),
        pricing: { ...this.pricingOf(ctx), paymentMethod: ctx.paymentMethod, actual: this.actualOf(ctx) },
        execution: this.executionSnapshot(ctx),
        handover: ctx.handover && {
          issuedAt: iso(ctx.handover.issuedAt),
          issuedByName: ctx.handover.issuedBy?.fullName ?? null,
          mileageKm: ctx.handover.mileageKm,
          fuelPercent: ctx.handover.fuelPercent,
          warrantyBookIssued: ctx.handover.warrantyBookIssued,
          warrantyTermsExplained: ctx.handover.warrantyTermsExplained,
          warrantyMonths: ctx.handover.warrantyMonths,
          warrantyStartsAt: iso(ctx.handover.warrantyStartsAt),
          warrantyTerms: ctx.handover.warrantyTerms,
          careRecommendations: ctx.handover.careRecommendations,
        },
        acceptanceDate: iso(ctx.inspection?.receivedAt),
      }),
    );
  }

  /** Фактическое выполнение для акта: каждая работа со статусом, мастером, датами, объёмом и согласованием. */
  private executionSnapshot(ctx: VisitCtx) {
    const started = ctx.workItems.map((i) => i.startedAt).filter((d): d is Date => !!d);
    const finished = ctx.workItems.map((i) => i.finishedAt).filter((d): d is Date => !!d);
    return {
      startedAt: started.length ? new Date(Math.min(...started.map((d) => d.getTime()))).toISOString() : null,
      finishedAt: finished.length ? new Date(Math.max(...finished.map((d) => d.getTime()))).toISOString() : null,
      items: ctx.workItems.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: this.titleOf(i),
        comment: i.comment,
        priceRub: i.priceRub,
        status: i.status,
        masterName: i.master?.fullName ?? null,
        startedAt: i.startedAt ? i.startedAt.toISOString() : null,
        finishedAt: i.finishedAt ? i.finishedAt.toISOString() : null,
        actualVolume: i.actualVolume,
        workNote: i.workNote,
        defectPlace: i.defectPlace,
        approval:
          i.kind === "EXTRA"
            ? {
                status: i.approvalStatus,
                approvedAt: i.approvedAt ? i.approvedAt.toISOString() : null,
                approvedBy: i.approvedBy,
                channel: i.approvalChannel,
                note: i.approvalNote,
              }
            : null,
        photosBefore: i.photos.filter((p) => p.stage === "WORK_BEFORE").length,
        photosAfter: i.photos.filter((p) => p.stage === "WORK_AFTER").length,
      })),
    };
  }

  private async load(visitId: number): Promise<VisitCtx> {
    const ctx = await this.prisma.visitHistory.findUnique({ where: { id: visitId }, include: visitInclude });
    if (!ctx) throw new NotFoundException("Запись не найдена");
    return ctx;
  }

  private async findVersion(visitId: number, versionId: number) {
    const v = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, document: { visitId } },
    });
    if (!v) throw new NotFoundException("Версия документа не найдена");
    return v;
  }

  /** Скан подписанного документа: PDF как есть, изображение — перекодируется (без EXIF). */
  private async storeScan(visitId: number, file: Express.Multer.File): Promise<string> {
    const buf = file.buffer;
    if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
      if (buf.length > MAX_PHOTO_BYTES) throw new BadRequestException("Максимальный размер скана — 15 МБ");
      const key = `documents/${visitId}/${randomUUID()}.pdf`;
      await this.storage.put(key, buf, "application/pdf");
      return key;
    }
    const photo = await normalizePhoto(buf);
    const key = `documents/${visitId}/${randomUUID()}.${photo.ext}`;
    await this.storage.put(key, photo.data, photo.contentType);
    return key;
  }
}
