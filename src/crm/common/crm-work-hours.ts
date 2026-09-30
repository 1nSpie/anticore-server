/**
 * Рабочее время и московские сутки для CRM.
 * Москва — UTC+3 круглый год (без перехода на летнее время).
 */
export const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Начало рабочего дня — 07:30 МСК (в минутах от полуночи). */
export const WORK_DAY_START_MIN = 7 * 60 + 30;
/** Конец рабочего дня — 20:00 МСК. */
export const WORK_DAY_END_MIN = 20 * 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Полночь МСК (как UTC-момент) для суток, в которые попадает `at`. */
export function mskDayStart(at: Date): Date {
  const mskMs = at.getTime() + MSK_OFFSET_MS;
  const dayStartMsk = Math.floor(mskMs / DAY_MS) * DAY_MS;
  return new Date(dayStartMsk - MSK_OFFSET_MS);
}

/** Границы московских суток `[00:00 МСК; 24:00 МСК)` в UTC. */
export function mskDayBounds(at: Date): { start: Date; end: Date } {
  const start = mskDayStart(at);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/**
 * Дата московских суток как UTC-полночь — для сравнения с колонками `@db.Date`
 * (Prisma отдаёт/принимает их как `YYYY-MM-DDT00:00:00Z`).
 */
export function mskDateAsUtcMidnight(at: Date): Date {
  const mskMs = at.getTime() + MSK_OFFSET_MS;
  return new Date(Math.floor(mskMs / DAY_MS) * DAY_MS);
}

/** Момент начала рабочего дня (07:30 МСК) для даты `YYYY-MM-DD`. */
export function workDayStartFor(dateYmd: string): Date {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  return new Date(utcMidnight - MSK_OFFSET_MS + WORK_DAY_START_MIN * 60 * 1000);
}
