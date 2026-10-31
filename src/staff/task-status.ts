import { TaskStatus } from "../../generated/prisma/client";

/** Статус для показа: к хранимому добавлены «Просрочена» (по сроку) и «Подтверждена» (по confirmedAt). */
export type TaskDisplayStatus = "NEW" | "IN_PROGRESS" | "DONE" | "CONFIRMED" | "OVERDUE" | "CANCELLED";

export interface TaskStateRow {
  status: TaskStatus;
  dueAt: Date | null;
  confirmedAt: Date | null;
}

export function taskDisplayStatus(t: TaskStateRow, now: Date): TaskDisplayStatus {
  if (t.status === TaskStatus.CANCELLED) return "CANCELLED";
  if (t.status === TaskStatus.DONE) return t.confirmedAt ? "CONFIRMED" : "DONE";
  if (t.dueAt && t.dueAt < now) return "OVERDUE";
  return t.status;
}

/** Задача ещё в работе у мастера (можно взять в работу / выполнить). */
export function isOpenForMaster(t: TaskStateRow): boolean {
  return t.status === TaskStatus.NEW || t.status === TaskStatus.IN_PROGRESS;
}
