import { BadRequestException } from "@nestjs/common";

export type GroupDef = {
  key: string;
  label: string;
  multiple: boolean;
  allowCustom: boolean;
  sortOrder: number;
  options: { name: string; active: boolean }[];
};

export type Selections = Record<string, string[]>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Проверяет выбранные параметры по справочнику категории. Значения вне справочника допустимы только там,
 * где разрешён свой вариант («Другое — с возможностью самостоятельного ввода»). Возвращает очищенные значения
 * с названиями из справочника (регистр и написание — как в справочнике).
 */
export function parseSelections(input: unknown, groups: GroupDef[]): Selections {
  if (!isObject(input)) throw new BadRequestException("Некорректные параметры работы");
  const out: Selections = {};
  for (const [key, raw] of Object.entries(input)) {
    const group = groups.find((g) => g.key === key);
    if (!group) throw new BadRequestException(`Неизвестный параметр: ${key}`);
    if (!Array.isArray(raw)) throw new BadRequestException(`${group.label}: ожидается список значений`);

    const values: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string") throw new BadRequestException(`${group.label}: некорректное значение`);
      const text = item.trim();
      if (!text) continue;
      if (text.length > 100) throw new BadRequestException(`${group.label}: значение длиннее 100 символов`);
      const known = group.options.find((o) => o.active && o.name.toLowerCase() === text.toLowerCase());
      if (!known && !group.allowCustom) {
        throw new BadRequestException(`${group.label}: «${text}» нет в справочнике`);
      }
      const name = known?.name ?? text;
      if (!values.some((v) => v.toLowerCase() === name.toLowerCase())) values.push(name);
    }
    if (!group.multiple && values.length > 1) {
      throw new BadRequestException(`${group.label}: можно выбрать только один вариант`);
    }
    if (values.length > 0) out[key] = values;
  }
  return out;
}

/** Строка позиции для договора и актов: «Антикоррозийная обработка: Комплексная обработка; ML; зоны: Днище, Арки». */
export function itemTitle(
  category: { name: string; groups: { key: string; sortOrder: number }[] },
  selections: Selections,
): string {
  const order = [...category.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const parts: string[] = [];
  for (const g of order) {
    const values = selections[g.key];
    if (!values?.length) continue;
    parts.push(g.key === "zones" ? `зоны: ${values.join(", ")}` : values.join(", "));
  }
  return parts.length ? `${category.name}: ${parts.join("; ")}` : category.name;
}
