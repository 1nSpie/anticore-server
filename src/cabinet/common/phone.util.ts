import { BadRequestException } from "@nestjs/common";

/** Формат хранения: `79XXXXXXXXX` (11 цифр, мобильный РФ). */
export const PHONE_RU_STORAGE_REGEX = /^79\d{9}$/;

const PHONE_ERROR =
  "Укажите мобильный номер России в формате +7 9XX XXX XX XX";

/**
 * Нормализация российского мобильного номера в вид «79XXXXXXXXX».
 * Должна совпадать с `anticore-client/src/lib/phoneRu.ts`.
 */
export function normalizePhoneRu(input: string): string {
  const digits = input.replace(/\D/g, "");
  let normalized: string;
  if (digits.length === 10) {
    normalized = `7${digits}`;
  } else if (digits.length === 11 && digits.startsWith("8")) {
    normalized = `7${digits.slice(1)}`;
  } else if (digits.length === 11 && digits.startsWith("7")) {
    normalized = digits;
  } else {
    throw new BadRequestException(PHONE_ERROR);
  }
  if (!PHONE_RU_STORAGE_REGEX.test(normalized)) {
    throw new BadRequestException(PHONE_ERROR);
  }
  return normalized;
}

export function isValidPhoneRu(input: string): boolean {
  try {
    normalizePhoneRu(input);
    return true;
  } catch {
    return false;
  }
}
