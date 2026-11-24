import { BadRequestException } from "@nestjs/common";

export type WorkStatus = "WAITING" | "IN_PROGRESS" | "DONE" | "PAUSED" | "NEEDS_APPROVAL" | "CANCELLED";

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  WAITING: "Ожидает выполнения",
  IN_PROGRESS: "В работе",
  DONE: "Выполнено",
  PAUSED: "Приостановлено",
  NEEDS_APPROVAL: "Требуется согласование",
  CANCELLED: "Отменено по согласованию",
};

/** Допустимые переходы статуса позиции (ТЗ §13.1). Допработа до решения клиента меняется только через согласование. */
const TRANSITIONS: Record<WorkStatus, WorkStatus[]> = {
  WAITING: ["IN_PROGRESS", "NEEDS_APPROVAL", "CANCELLED"],
  IN_PROGRESS: ["DONE", "PAUSED", "NEEDS_APPROVAL", "WAITING", "CANCELLED"],
  PAUSED: ["IN_PROGRESS", "NEEDS_APPROVAL", "CANCELLED"],
  NEEDS_APPROVAL: ["WAITING", "IN_PROGRESS", "CANCELLED"],
  DONE: ["IN_PROGRESS"],
  CANCELLED: ["WAITING"],
};

export function assertTransition(from: WorkStatus, to: WorkStatus): void {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(
      `Нельзя перевести работу из состояния «${WORK_STATUS_LABEL[from]}» в «${WORK_STATUS_LABEL[to]}»`,
    );
  }
}

/** Работа закончена для акта: выполнена либо отменена по согласованию. */
export const isFinal = (status: string) => status === "DONE" || status === "CANCELLED";

export const APPROVAL_CHANNELS = ["PHONE", "MESSENGER", "EMAIL", "IN_PERSON", "OTHER"] as const;
export const APPROVAL_CHANNEL_LABEL: Record<(typeof APPROVAL_CHANNELS)[number], string> = {
  PHONE: "Телефон",
  MESSENGER: "Мессенджер",
  EMAIL: "Электронная почта",
  IN_PERSON: "Лично",
  OTHER: "Другое",
};

import type { MissingField } from "../inspection/inspection-readiness";

export type HandoverLike = {
  issuedAt: Date | null;
  warrantyBookIssued: boolean | null;
  warrantyTermsExplained: boolean | null;
  warrantyMonths: number | null;
  warrantyStartsAt: Date | null;
} | null;

/**
 * Что нужно внести при выдаче, чтобы сформировать акт выполненных работ (ТЗ §14.6–14.7).
 * Всё вносится явно: ни срок гарантии, ни время выдачи не подставляются автоматически.
 */
export function handoverMissing(h: HandoverLike): MissingField[] {
  const out: MissingField[] = [];
  const add = (code: string, label: string) => out.push({ code, field: "handover", label });
  if (!h?.issuedAt) add("handover.issuedAt", "Фактические дата и время выдачи автомобиля");
  if (h?.warrantyBookIssued == null) add("handover.warrantyBook", "Гарантийная книжка: выдана или нет");
  if (h?.warrantyTermsExplained == null) add("handover.warrantyTerms", "Гарантийные условия: разъяснены или нет");
  if (h?.warrantyBookIssued === true) {
    if (h.warrantyMonths == null) add("handover.warrantyMonths", "Срок гарантии");
    if (!h.warrantyStartsAt) add("handover.warrantyStart", "Начало срока гарантии");
  }
  return out;
}
