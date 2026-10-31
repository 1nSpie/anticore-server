// Тестовые сотрудники для локальной разработки: описание аккаунтов и защита от запуска на боевой базе.
// Чистые функции без обращения к БД — их проверяет тест `src/staff/test-staff-seed.spec.ts`.
// Запуск: `npm run seed-test-staff` (из anticore-server) или `npm run seed:test-staff` (из корня проекта).

/**
 * Пароль всех тестовых учёток. ТОЛЬКО для локальной разработки: сид не запускается на нелокальной базе.
 * Переопределяется переменной окружения TEST_STAFF_PASSWORD (не короче 8 символов — как при создании учётки в админке).
 */
export const TEST_PASSWORD = "Test-pass-2026";

/** Все логины тестовых учёток начинаются с этого префикса — сид трогает только их, реальных сотрудников не касается. */
export const TEST_LOGIN_PREFIX = "test.";

type Branch = "ZHUKOVSKY" | "RAMENSKOYE" | "KOLOMNA";
const ALL_BRANCHES: Branch[] = ["ZHUKOVSKY", "RAMENSKOYE", "KOLOMNA"];

export interface TestStaff {
  login: string;
  fullName: string;
  role: "ADMIN" | "MASTER";
  locations: Branch[];
  /** Учётка заблокирована — для проверки сценария «вход заблокированного». */
  blocked?: boolean;
  /** Для чего эта учётка. */
  note: string;
}

export const TEST_STAFF: TestStaff[] = [
  { login: "test.admin1", fullName: "Тест Админ 1", role: "ADMIN", locations: ALL_BRANCHES, note: "администратор: вся админка" },
  { login: "test.admin2", fullName: "Тест Админ 2", role: "ADMIN", locations: ALL_BRANCHES, note: "второй администратор (проверка журнала: кто что сделал)" },
  { login: "test.master.zhukovsky", fullName: "Тест Мастер Жуковский", role: "MASTER", locations: ["ZHUKOVSKY"], note: "мастер одного филиала — Жуковский" },
  { login: "test.master.ramenskoye", fullName: "Тест Мастер Раменское", role: "MASTER", locations: ["RAMENSKOYE"], note: "мастер одного филиала — Раменское" },
  { login: "test.master.chanki", fullName: "Тест Мастер Чанки", role: "MASTER", locations: ["KOLOMNA"], note: "мастер одного филиала — Чанки (Коломна)" },
  { login: "test.master.all", fullName: "Тест Мастер (все филиалы)", role: "MASTER", locations: ALL_BRANCHES, note: "мастер на трёх филиалах (автоопределение филиала по геолокации)" },
  { login: "test.master.blocked", fullName: "Тест Мастер Заблокирован", role: "MASTER", locations: ["ZHUKOVSKY"], blocked: true, note: "заблокирован: вход должен отказывать" },
];

/** Пароль для сида: из окружения или по умолчанию; слишком короткий — ошибка (в админке такой не создать). */
export function resolvePassword(env: Record<string, string | undefined> = process.env): string {
  const password = env.TEST_STAFF_PASSWORD?.trim() || TEST_PASSWORD;
  if (password.length < 8) throw new Error("TEST_STAFF_PASSWORD должен быть не короче 8 символов");
  return password;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Можно ли запускать сид на этой базе: только локальная (localhost / 127.0.0.1 / ::1).
 * Нераспознанный адрес — «нельзя»: лучше отказать, чем завести известный пароль на чужой базе.
 */
export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Причина отказа запуска или null, если запускать можно. */
export function refusalReason(env: Record<string, string | undefined> = process.env): string | null {
  if (env.NODE_ENV === "production") return "NODE_ENV=production — тестовые учётки с известным паролем на проде заводить нельзя";
  if (!isLocalDatabaseUrl(env.DATABASE_URL)) return "DATABASE_URL указывает не на локальную базу (localhost/127.0.0.1) — отказываюсь заводить тестовые учётки";
  return null;
}
