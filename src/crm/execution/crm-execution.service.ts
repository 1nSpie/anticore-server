import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Request } from "express";
import type { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "../../staff/staff-audit.service";
import { normalizePhoto } from "../../storage/normalize-image";
import { ObjectStorageService } from "../../storage/object-storage.service";
import { MAX_VISIT_PHOTOS } from "../inspection/crm-inspection.service";
import { checkInt } from "../inspection/inspection.rules";
import { categoryInclude, toGroupDefs, type CategoryRow } from "../services/catalog.util";
import { agreedOnly, computeActual, computePricing } from "../services/pricing";
import { itemTitle, parseSelections, type Selections } from "../services/services.rules";
import type {
  CreateExtraDto, DecideExtraDto, UpdateExecutionDto, UpdateExtraDto, UpdateHandoverDto,
} from "./dto/execution.dto";
import { assertTransition, handoverMissing, isFinal, type WorkStatus } from "./execution.rules";

const visitInclude = {
  workItems: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      category: { include: { groups: true } },
      master: { select: { id: true, fullName: true } },
      photos: { orderBy: { id: "asc" } },
    },
  },
  assignees: { select: { staff: { select: { id: true, fullName: true } } }, orderBy: { assignedAt: "asc" } },
  handover: { include: { issuedBy: { select: { id: true, fullName: true } } } },
  inspection: { select: { mileageKm: true, fuelPercent: true } },
} satisfies Prisma.VisitHistoryInclude;

type VisitCtx = Prisma.VisitHistoryGetPayload<{ include: typeof visitInclude }>;
type ItemRow = VisitCtx["workItems"][number];

/** Выполнение работ, допработы с согласованием клиента и выдача автомобиля (ТЗ §13–14). */
@Injectable()
export class CrmExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly audit: StaffAuditService,
  ) {}

  // --- выполнение ---------------------------------------------------------------------------

  async get(visitId: number) {
    const [visit, signed, staff] = await Promise.all([
      this.load(visitId),
      this.worksActSigned(visitId),
      this.prisma.staff.findMany({ where: { blockedAt: null }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    ]);
    return this.present(visit, signed, staff);
  }

  async updateItem(visitId: number, itemId: number, dto: UpdateExecutionDto, req: Request) {
    const visit = await this.load(visitId);
    const item = this.requireItem(visit, itemId);
    await this.assertNotSigned(visitId);
    if (item.kind === "EXTRA" && item.approvalStatus !== "APPROVED" && dto.status !== undefined) {
      throw new BadRequestException("Допработа ещё не согласована с клиентом: сначала зафиксируйте его решение");
    }

    const data: Prisma.VisitWorkItemUncheckedUpdateInput = {};
    if (dto.masterId !== undefined) {
      if (dto.masterId !== null) await this.requireStaff(dto.masterId, "Мастер не найден");
      data.masterId = dto.masterId;
    }
    if (dto.actualVolume !== undefined) data.actualVolume = dto.actualVolume?.trim() || null;
    if (dto.workNote !== undefined) data.workNote = dto.workNote?.trim() || null;

    const from = item.status as WorkStatus;
    if (dto.status && dto.status !== from) {
      assertTransition(from, dto.status);
      let master = data.masterId !== undefined ? (data.masterId as number | null) : item.masterId;
      if (master == null && visit.assignees.length === 1) {
        master = visit.assignees[0].staff.id; // единственный назначенный мастер
        data.masterId = master;
      }
      if (dto.status === "CANCELLED") {
        const reason = ((data.workNote as string | null | undefined) ?? item.workNote)?.trim();
        if (!reason || reason.length < 3) {
          throw new BadRequestException("Укажите причину: работа отменяется только по согласованию с клиентом");
        }
      }
      if (dto.status === "DONE" && master == null) {
        throw new BadRequestException("Укажите ответственного мастера");
      }
      const now = new Date();
      if (dto.status === "IN_PROGRESS" && !item.startedAt) data.startedAt = now;
      if (dto.status === "DONE") {
        data.finishedAt = now;
        if (!item.startedAt) data.startedAt = now;
      }
      if (from === "DONE") data.finishedAt = null; // вернули в работу
      data.status = dto.status;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.visitWorkItem.update({ where: { id: itemId }, data });
      await this.audit.log({
        action: StaffAuditAction.WORK_STATUS_CHANGED,
        actor: adminActor(req),
        req,
        meta: JSON.parse(JSON.stringify({ visitId, itemId, from, to: dto.status ?? from, fields: Object.keys(data) })),
      });
    }
    return this.get(visitId);
  }

  // --- допработы ----------------------------------------------------------------------------

  async addExtra(visitId: number, dto: CreateExtraDto, req: Request) {
    const visit = await this.load(visitId);
    await this.assertNotSigned(visitId);
    const category = await this.requireCategory(dto.categoryId);
    const selections = parseSelections(dto.selections, toGroupDefs(category));
    const last = visit.workItems.at(-1);
    const item = await this.prisma.visitWorkItem.create({
      data: {
        visitId,
        categoryId: category.id,
        kind: "EXTRA",
        status: "NEEDS_APPROVAL",
        approvalStatus: "PENDING",
        selections: selections as unknown as Prisma.InputJsonValue,
        comment: dto.comment.trim(),
        defectPlace: dto.defectPlace?.trim() || null,
        termChangeNote: dto.termChangeNote?.trim() || null,
        priceRub: dto.priceRub ?? null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    await this.log(StaffAuditAction.EXTRA_WORK_ADDED, req, { visitId, itemId: item.id, category: category.name, priceRub: item.priceRub });
    return this.get(visitId);
  }

  async updateExtra(visitId: number, itemId: number, dto: UpdateExtraDto, req: Request) {
    const visit = await this.load(visitId);
    const item = this.requireExtra(visit, itemId);
    if (item.approvalStatus !== "PENDING") {
      throw new ConflictException("Допработа уже согласована или отклонена: изменить её нельзя, создайте новую");
    }
    const category = await this.requireCategory(item.categoryId, true);
    const data: Prisma.VisitWorkItemUncheckedUpdateInput = {};
    if (dto.selections !== undefined) {
      data.selections = parseSelections(dto.selections, toGroupDefs(category)) as unknown as Prisma.InputJsonValue;
    }
    if (dto.comment !== undefined) data.comment = dto.comment.trim();
    if (dto.defectPlace !== undefined) data.defectPlace = dto.defectPlace?.trim() || null;
    if (dto.termChangeNote !== undefined) data.termChangeNote = dto.termChangeNote?.trim() || null;
    if (dto.priceRub !== undefined) data.priceRub = dto.priceRub;
    await this.prisma.visitWorkItem.update({ where: { id: itemId }, data });
    await this.log(StaffAuditAction.EXTRA_WORK_ADDED, req, { visitId, itemId, change: "updated", fields: Object.keys(data) });
    return this.get(visitId);
  }

  /** Решение клиента по допработе: когда, кто принял, каким способом, подтверждение (ТЗ §13.2). */
  async decideExtra(visitId: number, itemId: number, dto: DecideExtraDto, req: Request) {
    const visit = await this.load(visitId);
    const item = this.requireExtra(visit, itemId);
    await this.assertNotSigned(visitId);
    if (item.approvalStatus !== "PENDING") throw new ConflictException("Решение по этой допработе уже зафиксировано");
    if (dto.decision === "APPROVED" && item.priceRub == null) {
      throw new BadRequestException("Укажите стоимость допработы: клиент соглашается на конкретную сумму");
    }
    const approvedAt = dto.approvedAt ? new Date(dto.approvedAt) : new Date();
    if (Number.isNaN(approvedAt.getTime())) throw new BadRequestException("Некорректные дата и время решения");
    const actor = adminActor(req);
    await this.prisma.visitWorkItem.update({
      where: { id: itemId },
      data: {
        approvalStatus: dto.decision,
        approvedAt,
        approvedBy: dto.approvedBy?.trim() || actor,
        approvalChannel: dto.channel,
        approvalNote: dto.note?.trim() || null,
        status: dto.decision === "APPROVED" ? "WAITING" : "CANCELLED",
        ...(dto.decision === "REJECTED" && !item.workNote && { workNote: "Клиент отказался от допработы" }),
      },
    });
    await this.log(StaffAuditAction.EXTRA_WORK_DECIDED, req, {
      visitId, itemId, decision: dto.decision, channel: dto.channel, approvedAt: approvedAt.toISOString(),
      ...(dto.note && { note: dto.note }),
    });
    return this.get(visitId);
  }

  async deleteExtra(visitId: number, itemId: number, req: Request) {
    const visit = await this.load(visitId);
    const item = this.requireExtra(visit, itemId);
    if (item.approvalStatus === "APPROVED") throw new ConflictException("Согласованную допработу удалить нельзя — отмените её по согласованию");
    for (const p of item.photos) await this.storage.remove(p.key);
    await this.prisma.visitWorkItem.delete({ where: { id: itemId } });
    await this.log(StaffAuditAction.EXTRA_WORK_DELETED, req, { visitId, itemId });
    return this.get(visitId);
  }

  // --- фото до/после ------------------------------------------------------------------------

  async addPhoto(visitId: number, itemId: number, stage: "WORK_BEFORE" | "WORK_AFTER", file: Express.Multer.File | undefined, req: Request) {
    const visit = await this.load(visitId);
    this.requireItem(visit, itemId);
    await this.assertNotSigned(visitId);
    const count = await this.prisma.visitPhoto.count({ where: { visitId } });
    if (count >= MAX_VISIT_PHOTOS) throw new BadRequestException(`К записи можно прикрепить не больше ${MAX_VISIT_PHOTOS} фото`);
    const photo = await normalizePhoto(file?.buffer);
    const key = `visits/${visitId}/${randomUUID()}.${photo.ext}`;
    await this.storage.put(key, photo.data, photo.contentType);
    try {
      await this.prisma.visitPhoto.create({
        data: { visitId, stage, section: "GENERAL", workItemId: itemId, key, size: photo.data.length, uploadedBy: adminActor(req) },
      });
    } catch (e) {
      await this.storage.remove(key); // не оставляем сиротский объект
      throw e;
    }
    await this.log(StaffAuditAction.WORK_PHOTO_ADDED, req, { visitId, itemId, stage });
    return this.get(visitId);
  }

  async deletePhoto(visitId: number, itemId: number, photoId: number, req: Request) {
    await this.assertNotSigned(visitId);
    const photo = await this.prisma.visitPhoto.findFirst({ where: { id: photoId, visitId, workItemId: itemId } });
    if (!photo) throw new NotFoundException("Фото не найдено");
    await this.prisma.visitPhoto.delete({ where: { id: photoId } });
    await this.storage.remove(photo.key);
    await this.log(StaffAuditAction.WORK_PHOTO_DELETED, req, { visitId, itemId, photoId });
    return this.get(visitId);
  }

  // --- выдача -------------------------------------------------------------------------------

  async getHandover(visitId: number) {
    const [visit, staff] = await Promise.all([
      this.load(visitId),
      this.prisma.staff.findMany({ where: { blockedAt: null }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    ]);
    return this.presentHandover(visit, staff);
  }

  async updateHandover(visitId: number, dto: UpdateHandoverDto, req: Request) {
    const visit = await this.load(visitId);
    await this.assertNotSigned(visitId);
    const data: Prisma.VisitHandoverUncheckedUpdateInput = {};

    if (dto.issuedAt !== undefined) {
      const at = dto.issuedAt === null ? null : new Date(dto.issuedAt);
      if (at && Number.isNaN(at.getTime())) throw new BadRequestException("Некорректные дата и время выдачи");
      data.issuedAt = at;
    }
    if (dto.issuedById !== undefined) {
      if (dto.issuedById !== null) await this.requireStaff(dto.issuedById, "Сотрудник не найден");
      data.issuedById = dto.issuedById;
    }
    if (dto.mileageKm !== undefined) data.mileageKm = dto.mileageKm === null ? null : checkInt(dto.mileageKm, 0, 2_000_000, "Пробег, км");
    if (dto.fuelPercent !== undefined) data.fuelPercent = dto.fuelPercent === null ? null : checkInt(dto.fuelPercent, 0, 100, "Уровень топлива, %");
    if (dto.warrantyBookIssued !== undefined) data.warrantyBookIssued = dto.warrantyBookIssued;
    if (dto.warrantyTermsExplained !== undefined) data.warrantyTermsExplained = dto.warrantyTermsExplained;
    if (dto.warrantyMonths !== undefined) {
      data.warrantyMonths = dto.warrantyMonths === null ? null : checkInt(dto.warrantyMonths, 1, 120, "Срок гарантии, мес.");
    }
    if (dto.warrantyStartsAt !== undefined) {
      const d = dto.warrantyStartsAt === null ? null : new Date(dto.warrantyStartsAt);
      if (d && Number.isNaN(d.getTime())) throw new BadRequestException("Некорректная дата начала гарантии");
      data.warrantyStartsAt = d;
    }
    if (dto.warrantyTerms !== undefined) data.warrantyTerms = dto.warrantyTerms?.trim() || null;
    if (dto.careRecommendations !== undefined) data.careRecommendations = dto.careRecommendations?.trim() || null;

    if (Object.keys(data).length > 0) {
      await this.prisma.visitHandover.upsert({
        where: { visitId },
        create: { ...(data as Prisma.VisitHandoverUncheckedCreateInput), visitId },
        update: data,
      });
      await this.log(StaffAuditAction.HANDOVER_CHANGED, req, {
        visitId,
        before: visit.handover ? JSON.parse(JSON.stringify(visit.handover)) : null,
        after: JSON.parse(JSON.stringify(data)),
      });
    }
    return this.getHandover(visitId);
  }

  // ---------------------------------------------------------------------------------------------

  private present(visit: VisitCtx, signed: boolean, staff: { id: number; fullName: string }[]) {
    const url = (key: string) => this.storage.publicUrl(key);
    const items = visit.workItems.map((i) => ({
      id: i.id,
      kind: i.kind,
      categoryName: i.category.name,
      title: itemTitle(i.category, i.selections as unknown as Selections),
      comment: i.comment,
      priceRub: i.priceRub,
      status: i.status,
      master: i.master,
      startedAt: i.startedAt,
      finishedAt: i.finishedAt,
      actualVolume: i.actualVolume,
      workNote: i.workNote,
      defectPlace: i.defectPlace,
      termChangeNote: i.termChangeNote,
      approval: i.kind === "EXTRA"
        ? { status: i.approvalStatus, approvedAt: i.approvedAt, approvedBy: i.approvedBy, channel: i.approvalChannel, note: i.approvalNote }
        : null,
      photosBefore: i.photos.filter((p) => p.stage === "WORK_BEFORE").map((p) => ({ id: p.id, url: url(p.key) })),
      photosAfter: i.photos.filter((p) => p.stage === "WORK_AFTER").map((p) => ({ id: p.id, url: url(p.key) })),
    }));
    const started = visit.workItems.map((i) => i.startedAt).filter((d): d is Date => !!d);
    const active = visit.workItems.filter((i) => i.status !== "CANCELLED");
    const allDone = active.length > 0 && active.every((i) => i.status === "DONE");
    return {
      visitId: visit.id,
      /** Фактическое начало работ — самое раннее начало позиции; завершение — когда выполнены все. */
      workStartedAt: started.length ? new Date(Math.min(...started.map((d) => d.getTime()))) : null,
      workFinishedAt: allDone
        ? new Date(Math.max(...visit.workItems.map((i) => i.finishedAt?.getTime() ?? 0)))
        : null,
      items,
      summary: {
        unfinished: visit.workItems.filter((i) => !isFinal(i.status) && !(i.kind === "EXTRA" && i.approvalStatus === "PENDING")).length,
        pendingExtras: visit.workItems.filter((i) => i.kind === "EXTRA" && i.approvalStatus === "PENDING").length,
      },
      pricing: {
        contract: computePricing({
          items: agreedOnly(visit.workItems),
          fallbackPriceRub: null,
          discountPercent: visit.discountPercent,
          discountRub: visit.discountRub,
          paidRub: visit.paidRub,
        }),
        actual: computeActual({
          items: visit.workItems,
          discountPercent: visit.discountPercent,
          discountRub: visit.discountRub,
          paidRub: visit.paidRub,
        }),
      },
      masters: this.mergeStaff(visit, staff),
      /** Акт выполненных работ подписан — выполнение и выдача больше не меняются. */
      signed,
    };
  }

  private presentHandover(visit: VisitCtx, staff: { id: number; fullName: string }[]) {
    const h = visit.handover;
    return {
      visitId: visit.id,
      handover: h && {
        issuedAt: h.issuedAt,
        issuedBy: h.issuedBy,
        mileageKm: h.mileageKm,
        fuelPercent: h.fuelPercent,
        warrantyBookIssued: h.warrantyBookIssued,
        warrantyTermsExplained: h.warrantyTermsExplained,
        warrantyMonths: h.warrantyMonths,
        warrantyStartsAt: h.warrantyStartsAt,
        warrantyTerms: h.warrantyTerms,
        careRecommendations: h.careRecommendations,
      },
      /** Показатели при приёмке: при выдаче вносят только если они изменились. */
      reception: { mileageKm: visit.inspection?.mileageKm ?? null, fuelPercent: visit.inspection?.fuelPercent ?? null },
      staff: this.mergeStaff(visit, staff),
      missing: handoverMissing(h),
    };
  }

  private mergeStaff(visit: VisitCtx, staff: { id: number; fullName: string }[]) {
    const map = new Map<number, string>();
    visit.assignees.forEach((a) => map.set(a.staff.id, a.staff.fullName));
    staff.forEach((s) => map.set(s.id, s.fullName));
    visit.workItems.forEach((i) => i.master && map.set(i.master.id, i.master.fullName));
    return [...map.entries()].map(([id, fullName]) => ({ id, fullName, assigned: visit.assignees.some((a) => a.staff.id === id) }));
  }

  private async load(visitId: number): Promise<VisitCtx> {
    const visit = await this.prisma.visitHistory.findUnique({ where: { id: visitId }, include: visitInclude });
    if (!visit) throw new NotFoundException("Запись не найдена");
    return visit;
  }

  private requireItem(visit: VisitCtx, itemId: number): ItemRow {
    const item = visit.workItems.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException("Позиция не найдена");
    return item;
  }

  private requireExtra(visit: VisitCtx, itemId: number): ItemRow {
    const item = this.requireItem(visit, itemId);
    if (item.kind !== "EXTRA") throw new NotFoundException("Допработа не найдена");
    return item;
  }

  private async requireStaff(id: number, message: string) {
    const s = await this.prisma.staff.findUnique({ where: { id }, select: { id: true } });
    if (!s) throw new BadRequestException(message);
  }

  private async requireCategory(id: number, allowInactive = false): Promise<CategoryRow> {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id }, include: categoryInclude });
    if (!category || (!allowInactive && !category.active)) throw new BadRequestException("Категория услуг не найдена");
    return category;
  }

  private worksActSigned(visitId: number) {
    return this.prisma.documentVersion
      .findFirst({ where: { status: "SIGNED", document: { visitId, kind: "WORKS" } }, select: { id: true } })
      .then((v) => v !== null);
  }

  /** После подписания акта выполненных работ факт выполнения и выдачи не меняется (ТЗ §18). */
  private async assertNotSigned(visitId: number) {
    if (await this.worksActSigned(visitId)) {
      throw new ConflictException("Акт выполненных работ подписан: изменить выполнение и выдачу нельзя");
    }
  }

  private log(action: string, req: Request, meta: Record<string, unknown>) {
    return this.audit.log({ action, actor: adminActor(req), req, meta: JSON.parse(JSON.stringify(meta)) });
  }
}
