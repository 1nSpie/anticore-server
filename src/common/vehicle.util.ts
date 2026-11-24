import { BadRequestException } from "@nestjs/common";

const MIN_YEAR = 1900;

/** Год выпуска: целое от 1900 до следующего года (машины нового модельного года продают заранее). */
export function validateVehicleYear(year: number, now: Date = new Date()): number {
  const max = now.getFullYear() + 1;
  if (!Number.isInteger(year) || year < MIN_YEAR || year > max) {
    throw new BadRequestException(
      `Год выпуска: целое число от ${MIN_YEAR} до ${max}`,
    );
  }
  return year;
}

const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х",
};
const RUSSIAN_PLATE = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/;

/**
 * Госномер: без пробелов и дефисов, заглавными. В российских номерах только 12 кириллических букв, похожих на
 * латинские, поэтому латиницу, набранную по ошибке (A123AA211), приводим к кириллице — в документах должна быть одна
 * запись. Остальные (иностранные) номера оставляем как есть.
 */
export function normalizePlate(plate: string): string {
  const base = plate.replace(/[\s-]+/g, "").toUpperCase();
  const cyrillic = [...base].map((ch) => LATIN_TO_CYRILLIC[ch] ?? ch).join("");
  return RUSSIAN_PLATE.test(cyrillic) ? cyrillic : base;
}

export function validatePlate(plate: string): string {
  const normalized = normalizePlate(plate);
  if (!/^[A-ZА-ЯЁ0-9]{3,15}$/.test(normalized)) {
    throw new BadRequestException(
      "Госномер: 3–15 букв и цифр, без пробелов и спецсимволов",
    );
  }
  return normalized;
}
