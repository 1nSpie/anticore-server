import { DocumentKind, PhotoStage } from "../../generated/prisma/client";

export type ClosingInput = {
  photoStages: PhotoStage[];
  diskLink: string | null | undefined;
  /** Виды документов, у которых актуальная версия подписана. */
  signedKinds: DocumentKind[];
};

export type ClosingItem = { key: string; label: string; done: boolean };

const DOC_LABELS: Record<DocumentKind, string> = {
  CONTRACT: "Договор подписан",
  ACCEPTANCE: "Акт приёма-передачи подписан",
  WORKS: "Акт выполненных работ подписан",
};

/** Условия «машина закрыта»: только после них записи начисляется зарплата. */
export function closingChecklist(input: ClosingInput): ClosingItem[] {
  const has = (s: PhotoStage) => input.photoStages.includes(s);
  return [
    { key: "photoBefore", label: "Фото «до» работ", done: has(PhotoStage.WORK_BEFORE) },
    { key: "photoAfter", label: "Фото «после» работ", done: has(PhotoStage.WORK_AFTER) },
    { key: "diskLink", label: "Ссылка на фотоотчёт (Яндекс.Диск)", done: !!input.diskLink?.trim() },
    ...(Object.keys(DOC_LABELS) as DocumentKind[]).map((k) => ({
      key: `doc:${k}`,
      label: DOC_LABELS[k],
      done: input.signedKinds.includes(k),
    })),
  ];
}

export const closingMissing = (items: ClosingItem[]) => items.filter((i) => !i.done).map((i) => i.label);

/** Итог по начислению: ставка + доп. выплаты. */
export function entryTotal(baseRub: number, bonuses: { amountRub: number }[]): number {
  return baseRub + bonuses.reduce((s, b) => s + b.amountRub, 0);
}
