export const LOCATION_LABELS: Record<string, string> = {
  ZHUKOVSKY: "Жуковский",
  RAMENSKOYE: "Раменское",
  KOLOMNA: "Коломна",
};

export type CashRow = { direction: "IN" | "OUT"; amountRub: number; voidedAt: Date | null };

/** Сумма прихода и расхода (аннулированные операции не считаются) и итог за период. */
export function cashTotals(rows: CashRow[]) {
  let inRub = 0;
  let outRub = 0;
  for (const r of rows) {
    if (r.voidedAt) continue;
    if (r.direction === "IN") inRub += r.amountRub;
    else outRub += r.amountRub;
  }
  return { inRub, outRub, balanceRub: inRub - outRub };
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV для Excel: разделитель «;», BOM в начале. */
export function toCsv(header: string[], lines: unknown[][]): string {
  return "﻿" + [header, ...lines].map((l) => l.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
