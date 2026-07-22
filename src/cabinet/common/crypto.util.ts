import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashOpaqueToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Сравнение SHA-256 (hex) токена из куки с сохранённым хешем без утечек по времени. */
export function safeCompareTokenHash(
  storedHashHex: string,
  rawSecret: string,
): boolean {
  try {
    const computed = hashOpaqueToken(rawSecret);
    const a = Buffer.from(storedHashHex, "hex");
    const b = Buffer.from(computed, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
