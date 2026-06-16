import { Request } from "express";

/** Публичный IP, который SMS.ru принимает в параметре `ip` (не localhost / RFC1918). */
export function isPublicClientIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  if (!normalized || normalized === "::1" || normalized === "0.0.0.0") {
    return false;
  }

  if (normalized.includes(":")) {
    if (normalized === "::1" || normalized.startsWith("fe80:")) return false;
    if (
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(normalized)
    ) {
      return false;
    }
    return true;
  }

  const parts = normalized.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 0) return false;
  if (a === 169 && b === 254) return false;
  if (a === 192 && b === 168) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  return true;
}

/** IP клиента для SMS.ru (параметр `ip`), с учётом прокси. */
export function clientIpFromRequest(req: Request): string | undefined {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]!.trim();
  }
  if (Array.isArray(xf) && xf[0]) {
    return String(xf[0]).trim();
  }
  const raw = req.socket?.remoteAddress ?? req.ip;
  if (!raw) return undefined;
  return raw.replace(/^::ffff:/, "");
}
