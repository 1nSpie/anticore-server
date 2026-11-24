import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Request } from "express";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "../../staff/staff-audit.service";
import { normalizePhoto } from "../../storage/normalize-image";
import { ObjectStorageService } from "../../storage/object-storage.service";
import { formatVehicleLabel } from "../common/crm-format.util";
import { acceptanceMissing, cardMissing, type MissingField } from "./inspection-readiness";
import { CreateMarkDto, UpdateInspectionDto, UpdateMarkDto } from "./dto/inspection.dto";
import { checkInt, parseInterior, parseSystems } from "./inspection.rules";

export const MAX_VISIT_PHOTOS = 60;

type PhotoMeta = { section?: "GENERAL" | "EXTERIOR" | "INTERIOR"; markId?: number };

const visitInclude = {
  user: { select: { id: true, phone: true, lastName: true, firstName: true, patronymic: true, birthDate: true } },
  vehicle: { include: { car: { select: { model: true, brand: { select: { name: true } } } } } },
  assignees: { select: { staff: { select: { id: true, fullName: true } } }, orderBy: { assignedAt: "asc" } },
  inspection: {
    include: {
      receivedBy: { select: { id: true, fullName: true } },
      marks: { orderBy: { id: "asc" } },
    },
  },
  photos: { where: { stage: "RECEPTION" }, orderBy: { id: "asc" } },
} satisfies Prisma.VisitHistoryInclude;

type VisitCtx = Prisma.VisitHistoryGetPayload<{ include: typeof visitInclude }>;

/** Приёмка автомобиля: данные визита, отметки на схеме, фото, проверка полноты (ТЗ §10). */
@Injectable()
export class CrmInspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly audit: StaffAuditService,
  ) {}

  async get(visitId: number) {
    return this.present(await this.load(visitId));
  }

  /** «Начать приёмку»: фиксирует фактическое время приёма; повторный вызов ничего не меняет. */
  async start(visitId: number) {
    const visit = await this.load(visitId);
    if (!visit.inspection) {
      await this.prisma.vehicleInspection.create({
        data: {
          visitId,
          receivedAt: new Date(),
          receivedById: visit.assignees.length === 1 ? visit.assignees[0].staff.id : null,
        },
      });
    }
    return this.get(visitId);
  }

  async update(visitId: number, dto: UpdateInspectionDto, req: Request) {
    const visit = await this.requireStarted(visitId);
    const insp = visit.inspection!;
    const data: Prisma.VehicleInspectionUncheckedUpdateInput = {};

    if (dto.receivedAt !== undefined) data.receivedAt = new Date(dto.receivedAt);
    if (dto.receivedById !== undefined) {
      if (dto.receivedById !== null) {
        const staff = await this.prisma.staff.findUnique({ where: { id: dto.receivedById }, select: { id: true } });
        if (!staff) throw new BadRequestException("Мастер-приёмщик не найден");
      }
      data.receivedById = dto.receivedById;
    }
    if (dto.mileageKm !== undefined) data.mileageKm = dto.mileageKm === null ? null : checkInt(dto.mileageKm, 0, 2_000_000, "Пробег, км");
    if (dto.fuelPercent !== undefined) data.fuelPercent = dto.fuelPercent === null ? null : checkInt(dto.fuelPercent, 0, 100, "Уровень топлива, %");
    if (dto.keysCount !== undefined) data.keysCount = dto.keysCount === null ? null : checkInt(dto.keysCount, 0, 20, "Количество ключей");
    if (dto.noDefectsConfirmed !== undefined) {
      if (dto.noDefectsConfirmed && insp.marks.length > 0) {
        throw new BadRequestException("На схеме есть отметки — «дефектов нет» подтвердить нельзя");
      }
      data.noDefectsConfirmed = dto.noDefectsConfirmed;
    }
    if (dto.interior !== undefined) data.interior = { ...((insp.interior as object) ?? {}), ...parseInterior(dto.interior) };
    if (dto.systems !== undefined) data.systems = { ...((insp.systems as object) ?? {}), ...parseSystems(dto.systems) };
    for (const key of ["exteriorNote", "interiorNote", "systemsNote", "specialTerms", "note"] as const) {
      if (dto[key] !== undefined) data[key] = dto[key]?.trim() || null;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.vehicleInspection.update({ where: { id: insp.id }, data });
      await this.audit.log({
        action: StaffAuditAction.INSPECTION_UPDATED,
        actor: adminActor(req),
        req,
        meta: { visitId, fields: Object.keys(data) },
      });
    }
    return this.get(visitId);
  }

  /** Сотрудник подтверждает, что сверил клиента и автомобиль (в т.ч. VIN с маркировкой). Фиксируем кто и когда. */
  async verify(visitId: number, req: Request) {
    const visit = await this.requireStarted(visitId);
    const missing = cardMissing({ client: visit.user, vehicle: visit.vehicle });
    if (missing.length > 0) throw this.incomplete("Нельзя подтвердить: не заполнены данные карточки", missing);
    const actor = adminActor(req);
    await this.prisma.vehicleInspection.update({
      where: { id: visit.inspection!.id },
      data: { dataVerifiedAt: new Date(), dataVerifiedBy: actor },
    });
    await this.audit.log({ action: StaffAuditAction.INSPECTION_VERIFIED, actor, req, meta: { visitId } });
    return this.get(visitId);
  }

  async addMark(visitId: number, dto: CreateMarkDto) {
    const visit = await this.requireStarted(visitId);
    const element = dto.element.trim();
    if (!element) throw new BadRequestException("Укажите кузовной элемент");
    await this.prisma.$transaction([
      this.prisma.inspectionMark.create({
        data: { inspectionId: visit.inspection!.id, type: dto.type, x: dto.x, y: dto.y, element, note: dto.note?.trim() || null },
      }),
      // Отметка появилась — «дефектов нет» больше не верно
      this.prisma.vehicleInspection.update({ where: { id: visit.inspection!.id }, data: { noDefectsConfirmed: false } }),
    ]);
    return this.get(visitId);
  }

  async updateMark(visitId: number, markId: number, dto: UpdateMarkDto) {
    const visit = await this.requireStarted(visitId);
    await this.requireMark(visit, markId);
    const element = dto.element?.trim();
    if (dto.element !== undefined && !element) throw new BadRequestException("Укажите кузовной элемент");
    await this.prisma.inspectionMark.update({
      where: { id: markId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.x !== undefined && { x: dto.x }),
        ...(dto.y !== undefined && { y: dto.y }),
        ...(element !== undefined && { element }),
        ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
      },
    });
    return this.get(visitId);
  }

  async deleteMark(visitId: number, markId: number) {
    const visit = await this.requireStarted(visitId);
    await this.requireMark(visit, markId);
    const photos = await this.prisma.visitPhoto.findMany({ where: { markId }, select: { key: true } });
    await this.prisma.inspectionMark.delete({ where: { id: markId } }); // фото удаляются каскадом
    for (const p of photos) await this.storage.remove(p.key);
    return this.get(visitId);
  }

  async addPhoto(visitId: number, file: Express.Multer.File | undefined, meta: PhotoMeta, req: Request) {
    const visit = await this.requireStarted(visitId);
    const count = await this.prisma.visitPhoto.count({ where: { visitId } });
    if (count >= MAX_VISIT_PHOTOS) throw new BadRequestException(`К записи можно прикрепить не больше ${MAX_VISIT_PHOTOS} фото`);
    if (meta.markId !== undefined) await this.requireMark(visit, meta.markId);

    const photo = await normalizePhoto(file?.buffer);
    const key = `visits/${visitId}/${randomUUID()}.${photo.ext}`;
    await this.storage.put(key, photo.data, photo.contentType);
    try {
      await this.prisma.visitPhoto.create({
        data: {
          visitId,
          stage: "RECEPTION",
          section: meta.markId !== undefined ? "EXTERIOR" : (meta.section ?? "GENERAL"),
          markId: meta.markId ?? null,
          key,
          size: photo.data.length,
          uploadedBy: adminActor(req),
        },
      });
    } catch (e) {
      await this.storage.remove(key); // не оставляем сиротский объект
      throw e;
    }
    await this.audit.log({ action: StaffAuditAction.INSPECTION_PHOTO_ADDED, actor: adminActor(req), req, meta: { visitId, markId: meta.markId ?? null } });
    return this.get(visitId);
  }

  async deletePhoto(visitId: number, photoId: number, req: Request) {
    const photo = await this.prisma.visitPhoto.findFirst({ where: { id: photoId, visitId } });
    if (!photo) throw new NotFoundException("Фото не найдено");
    await this.prisma.visitPhoto.delete({ where: { id: photoId } });
    await this.storage.remove(photo.key);
    await this.audit.log({ action: StaffAuditAction.INSPECTION_PHOTO_DELETED, actor: adminActor(req), req, meta: { visitId, photoId } });
    return this.get(visitId);
  }

  /** Для проверки полноты из других модулей (формирование документов). */
  async missingForAcceptance(visitId: number): Promise<MissingField[]> {
    return this.readiness(await this.load(visitId)).missing;
  }

  private readiness(visit: VisitCtx) {
    const missing = acceptanceMissing({
      client: visit.user,
      vehicle: visit.vehicle,
      inspection: visit.inspection,
      marksCount: visit.inspection?.marks.length ?? 0,
    });
    return { complete: missing.length === 0, missing };
  }

  private present(visit: VisitCtx) {
    const url = (key: string) => this.storage.publicUrl(key);
    const photo = (p: VisitCtx["photos"][number]) => ({ id: p.id, url: url(p.key), section: p.section, markId: p.markId, by: p.uploadedBy, createdAt: p.createdAt });
    const insp = visit.inspection;
    return {
      visitId: visit.id,
      started: insp !== null,
      inspection: insp && {
        id: insp.id,
        receivedAt: insp.receivedAt,
        receivedBy: insp.receivedBy,
        mileageKm: insp.mileageKm,
        fuelPercent: insp.fuelPercent,
        keysCount: insp.keysCount,
        noDefectsConfirmed: insp.noDefectsConfirmed,
        exteriorNote: insp.exteriorNote,
        interior: insp.interior ?? {},
        interiorNote: insp.interiorNote,
        systems: insp.systems ?? {},
        systemsNote: insp.systemsNote,
        specialTerms: insp.specialTerms,
        note: insp.note,
        dataVerifiedAt: insp.dataVerifiedAt,
        dataVerifiedBy: insp.dataVerifiedBy,
      },
      marks: (insp?.marks ?? []).map((m) => ({
        id: m.id, type: m.type, x: m.x, y: m.y, element: m.element, note: m.note,
        photos: visit.photos.filter((p) => p.markId === m.id).map(photo),
      })),
      photos: visit.photos.filter((p) => p.markId === null).map(photo),
      client: { id: visit.user.id, lastName: visit.user.lastName, firstName: visit.user.firstName, patronymic: visit.user.patronymic, phone: visit.user.phone, birthDate: visit.user.birthDate },
      vehicle: visit.vehicle && {
        id: visit.vehicle.id,
        label: formatVehicleLabel(visit.vehicle),
        year: visit.vehicle.year,
        vin: visit.vehicle.vin,
        plate: visit.vehicle.plate,
      },
      assignees: visit.assignees.map((a) => a.staff),
      readiness: this.readiness(visit),
    };
  }

  private async load(visitId: number): Promise<VisitCtx> {
    const visit = await this.prisma.visitHistory.findUnique({ where: { id: visitId }, include: visitInclude });
    if (!visit) throw new NotFoundException("Запись не найдена");
    return visit;
  }

  private async requireStarted(visitId: number): Promise<VisitCtx> {
    const visit = await this.load(visitId);
    if (!visit.inspection) throw new BadRequestException("Приёмка ещё не начата");
    return visit;
  }

  private async requireMark(visit: VisitCtx, markId: number) {
    if (!visit.inspection?.marks.some((m) => m.id === markId)) throw new NotFoundException("Отметка не найдена");
  }

  private incomplete(message: string, missing: MissingField[]) {
    return new BadRequestException({ message, missing });
  }
}
