/** Типы уведомлений мастеру (ТЗ 4.6 + решения по чекину и задачам). */
export const NotificationType = {
  TASK_NEW: "TASK_NEW",
  TASK_RETURNED: "TASK_RETURNED",
  TASK_CONFIRMED: "TASK_CONFIRMED",
  SCHEDULE_CHANGED: "SCHEDULE_CHANGED",
  ASSIGNED: "ASSIGNED",
  UNASSIGNED: "UNASSIGNED",
  REGULATION: "REGULATION",
  CHECKIN_CONFIRMED: "CHECKIN_CONFIRMED",
  CHECKIN_REJECTED: "CHECKIN_REJECTED",
} as const;

export type NotificationTypeCode = (typeof NotificationType)[keyof typeof NotificationType];

export interface NotificationInput {
  type: NotificationTypeCode;
  title: string;
  body?: string | null;
  /** Путь внутри кабинета мастера, например `/staff/regulation`. */
  link?: string | null;
}

const MSK = "Europe/Moscow";

/** «10 окт., 10:00» по Москве — для текстов уведомлений. */
export function fmtMsk(d: Date): string {
  return d.toLocaleString("ru-RU", { timeZone: MSK, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface VisitSnapshot {
  startsAt: Date | null;
  endsAt: Date | null;
  location: string | null;
  serviceType: string;
}

/** Что изменилось в записи, о чём нужно знать мастеру; null — ничего существенного (цена, комментарий, диск — не в счёт). */
export function scheduleChangeText(before: VisitSnapshot, after: VisitSnapshot): string | null {
  const t = (d: Date | null) => d?.getTime() ?? null;
  const moved = t(before.startsAt) !== t(after.startsAt) || t(before.endsAt) !== t(after.endsAt);
  const relocated = before.location !== after.location;
  const service = before.serviceType !== after.serviceType;
  if (!moved && !relocated && !service) return null;
  const when = after.startsAt ? fmtMsk(after.startsAt) : "время не указано";
  return `${after.serviceType}: ${when}`;
}
