import type { DocumentKind } from "../../../generated/prisma/client";
import { acceptanceMissing, cardMissing, type MissingField, type ReadinessInput } from "../inspection/inspection-readiness";
import { handoverMissing, isFinal, type HandoverLike } from "../execution/execution.rules";

export type DocumentReadinessInput = ReadinessInput & {
  client: ReadinessInput["client"] & { birthDate: Date | null };
  visit: {
    startsAt: Date | null;
    endsAt: Date | null;
    serviceType: string;
    completedAt: Date | null;
  };
  /** Согласованные работы и предварительная стоимость (null — «не определена»). */
  worksCount: number;
  preliminaryPrice: number | null;
  /** Выполнение работ и выдача — для акта выполненных работ. */
  execution: {
    agreed: { title: string; status: string }[];
    extras: { title: string; status: string; approvalStatus: string | null }[];
    /** Фактическая стоимость; null — у какой-то работы цена не определена. */
    actualTotal: number | null;
    handover: HandoverLike;
  };
  /** Есть ли у записи действующий (не аннулированный) документ данного вида. */
  has: { CONTRACT: boolean; ACCEPTANCE: boolean };
};

/**
 * Что должно быть заполнено, чтобы сформировать окончательный документ (ТЗ §3).
 * `field` — якорь для перехода к полю: карточка клиента и автомобиля, приёмка, visit (запись) или documents (вкладка документов).
 */
export function documentMissing(kind: DocumentKind, input: DocumentReadinessInput): MissingField[] {
  if (kind === "ACCEPTANCE") return acceptanceMissing(input);

  const out = cardMissing(input);
  const add = (code: string, field: string, label: string) => out.push({ code, field, label });
  const { visit } = input;

  if (kind === "CONTRACT") {
    if (!input.client.birthDate) add("client.birthDate", "client", "Дата рождения клиента");
    const insp = input.inspection;
    if (!insp) add("inspection", "inspection", "Приёмка не начата");
    else {
      if (insp.mileageKm == null) add("inspection.mileage", "mileageKm", "Пробег");
      if (!insp.dataVerifiedAt) add("inspection.verified", "verify", "Подтверждение проверки данных (VIN сверен с маркировкой)");
    }
    if (!visit.startsAt) add("visit.startsAt", "visit", "Плановое начало работ");
    if (!visit.endsAt) add("visit.endsAt", "visit", "Плановое окончание работ");
    if (input.worksCount === 0 && !visit.serviceType.trim()) {
      add("visit.service", "visit", "Согласованные работы (перечень)");
    }
    if (input.preliminaryPrice == null) add("visit.price", "visit", priceLabel(input.worksCount));
    return out;
  }

  // Акт выполненных работ: формируется по факту, после договора, акта приёма и завершения работ.
  if (!input.has.CONTRACT) add("documents.contract", "documents", "Договор не сформирован");
  if (!input.has.ACCEPTANCE) add("documents.acceptance", "documents", "Акт приёма-передачи не сформирован");

  // Акт формируется по факту выполнения (ТЗ §13.3, §14.3): все работы закончены, допработы решены клиентом
  const { execution } = input;
  for (const w of execution.agreed) {
    if (!isFinal(w.status)) add("execution.item", "execution", `Работа не завершена: ${w.title}`);
  }
  for (const w of execution.extras) {
    if (w.approvalStatus === "PENDING") add("execution.extra", "execution", `Допработа не согласована с клиентом: ${w.title}`);
    else if (w.approvalStatus === "APPROVED" && !isFinal(w.status)) add("execution.extra", "execution", `Допработа не выполнена: ${w.title}`);
  }
  if (execution.actualTotal == null) add("execution.price", "execution", "Стоимость каждой выполненной работы");
  out.push(...handoverMissing(execution.handover));
  return out;
}

const priceLabel = (worksCount: number) =>
  worksCount > 0 ? "Стоимость каждой работы в перечне" : "Предварительная стоимость";
