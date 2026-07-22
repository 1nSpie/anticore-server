import { Request } from "express";

/** Публичный IP, который SMS.ru принимает в параметре `ip` (не localhost / RFC1918). */
export function isPublicClientIp(ip: string): boolean {
  let normalized = ip.trim().toLowerCase();
  if (!normalized || normalized === "::1" || normalized === "0.0.0.0") {
    return false;
  }

  // Express / прокси часто отдают IPv4 как ::ffff:x.x.x.x
  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice(7);
  }

  if (normalized.includes(":")) {
    if (normalized === "::1" || normalized.startsWith("fe80:")) return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
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

function normalizeIpCandidate(raw: string): string {
  return raw.trim().replace(/^::ffff:/i, "");
}

/**
 * IP клиента для SMS.ru (параметр `ip`), с учётом `trust proxy`.
 * Берём первый публичный адрес из цепочки X-Forwarded-For / req.ip.
 */
export function clientIpFromRequest(req: Request): string | undefined {
  const candidates: string[] = [];

  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    for (const part of xf.split(",")) {
      const v = normalizeIpCandidate(part);
      if (v) candidates.push(v);
    }
  } else if (Array.isArray(xf)) {
    for (const item of xf) {
      for (const part of String(item).split(",")) {
        const v = normalizeIpCandidate(part);
        if (v) candidates.push(v);
      }
    }
  }

  // Express заполняет req.ip при app.set('trust proxy', true)
  if (req.ip) {
    candidates.push(normalizeIpCandidate(req.ip));
  }

  const remote = req.socket?.remoteAddress;
  if (remote) {
    candidates.push(normalizeIpCandidate(remote));
  }

  const seen = new Set<string>();
  for (const ip of candidates) {
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    if (isPublicClientIp(ip)) return ip;
  }

  // Если публичного нет (локальная разработка) — вернём первый кандидат для логов
  return candidates[0];
}
