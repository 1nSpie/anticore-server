import { BadRequestException } from "@nestjs/common";

/** Нормализация российского номера в вид «7XXXXXXXXXX» (11 цифр). */
export function normalizePhoneRu(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) {
    return `7${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return digits;
  }
  throw new BadRequestException(
    "Неверный формат телефона. Укажите номер в формате +7…",
  );
}
