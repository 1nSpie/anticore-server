import { BadRequestException } from "@nestjs/common";

/** ISO 3779 / NHTSA: допустимые символы (без I, O, Q). */
export const VIN_FORMAT_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Транслитерация символов VIN в числа (NHTSA). */
const CHAR_VALUES: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

/** Веса позиций 1–17 (позиция 9 имеет вес 0). */
const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeVin(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/** Североамериканские VIN (США, Канада, Мексика) — WMI начинается с 1–5. */
export function isNorthAmericanVin(vin: string): boolean {
  const c = vin[0];
  return c >= "1" && c <= "5";
}

/** Контрольная цифра для позиции 9 (NHTSA / ISO 3779). */
export function calculateVinCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    if (i === 8) continue;
    const value = CHAR_VALUES[vin[i]];
    if (value === undefined) {
      throw new Error(`invalid vin char at ${i + 1}`);
    }
    sum += value * POSITION_WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}

export type VinValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; message: string };

export function validateVinDetailed(input: string): VinValidationResult {
  const vin = normalizeVin(input);

  if (vin.length !== 17) {
    return {
      valid: false,
      message: "VIN должен содержать ровно 17 символов",
    };
  }

  if (/[IOQ]/.test(vin)) {
    return {
      valid: false,
      message:
        "VIN не может содержать буквы I, O и Q (их путают с 1 и 0)",
    };
  }

  if (!VIN_FORMAT_REGEX.test(vin)) {
    return {
      valid: false,
      message:
        "VIN может содержать только латинские буквы (кроме I, O, Q) и цифры 0–9",
    };
  }

  const serial = vin.slice(11);
  if (!/^\d{6}$/.test(serial)) {
    return {
      valid: false,
      message:
        "Последние 6 символов VIN (серийный номер) должны быть цифрами",
    };
  }

  if (/^(.)\1{16}$/.test(vin)) {
    return { valid: false, message: "Некорректный VIN" };
  }

  if (isNorthAmericanVin(vin)) {
    const expected = calculateVinCheckDigit(vin);
    const actual = vin[8]!;
    if (actual !== expected) {
      return {
        valid: false,
        message: `Неверная контрольная цифра VIN (9-й символ). По стандарту ожидается «${expected}»`,
      };
    }
  }

  return { valid: true, normalized: vin };
}

export function isValidVin(input: string): boolean {
  return validateVinDetailed(input).valid;
}

export function validateVin(input: string): string {
  const result = validateVinDetailed(input);
  if (!result.valid) {
    throw new BadRequestException(result.message);
  }
  return result.normalized;
}
