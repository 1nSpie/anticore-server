import { SiteLeadStatus } from "../../generated/prisma/client";
import { formatVehicleLabel } from "../crm/common/crm-format.util";
import { DEFAULT_CRM_LOCATION } from "../crm/common/crm-location";

export type MasterVisitStatus = "PLANNED" | "IN_PROGRESS" | "DONE";

/** Поля записи, достаточные для карточки мастера. Клиент (`user`) сюда намеренно не входит. */
export interface MasterVisitRow {
  id: number;
  startsAt: Date | null;
  endsAt: Date | null;
  visitDate: Date;
  serviceType: string;
  priceRub: number | null;
  masterComment: string | null;
  location: string | null;
  completedAt: Date | null;
  vehicle?: {
    customLabel: string | null;
    vin: string | null;
    car?: { model: string; brand?: { name: string } | null } | null;
  } | null;
  siteLead?: { status: SiteLeadStatus } | null;
}

/**
 * Статус для мастера выводится из записи (ТЗ 4.3): «Выполнено» — запись закрыта;
 * «В работе» — день записи наступил (заявка на подъёмнике) или идёт время записи; иначе «Запланировано».
 * «Отменено» в MVP не показываем: отменённая запись удаляется из календаря и пропадает из расписания.
 */
export function masterVisitStatus(row: MasterVisitRow, now: Date): MasterVisitStatus {
  if (row.completedAt) return "DONE";
  const start = row.startsAt ?? row.visitDate;
  const end = row.endsAt ?? new Date(start.getTime() + 60 * 60 * 1000);
  if (row.siteLead?.status === SiteLeadStatus.IN_PROGRESS) return "IN_PROGRESS";
  return start <= now && now <= end ? "IN_PROGRESS" : "PLANNED";
}

/** Карточка записи для мастера: модель авто, услуга, цена. Данные клиента не отдаём (ТЗ 4.3). */
export function toMasterVisit(row: MasterVisitRow, now: Date) {
  const start = row.startsAt ?? row.visitDate;
  const end = row.endsAt ?? new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id: row.id,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    location: row.location ?? DEFAULT_CRM_LOCATION,
    serviceType: row.serviceType,
    priceRub: row.priceRub ?? 0,
    status: masterVisitStatus(row, now),
    vehicle: row.vehicle
      ? { label: formatVehicleLabel(row.vehicle) || null, vin: row.vehicle.vin }
      : null,
    comment: row.masterComment,
  };
}
