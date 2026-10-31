import { TEST_LOGIN_PREFIX, TEST_PASSWORD, TEST_STAFF, isLocalDatabaseUrl, refusalReason, resolvePassword } from "../../prisma/test-staff.lib";

describe("сид тестовых сотрудников — защита от запуска на боевой базе", () => {
  it("локальные адреса разрешены", () => {
    for (const url of [
      "postgresql://u:p@localhost:5432/anticore?schema=public",
      "postgresql://u:p@127.0.0.1:5432/anticore",
      "postgresql://u:p@[::1]:5432/anticore",
      "postgres://u:p@LOCALHOST/anticore",
    ]) {
      expect(isLocalDatabaseUrl(url)).toBe(true);
    }
  });

  it("любой нелокальный, пустой и нераспознанный адрес — запрещён (лучше отказать, чем завести известный пароль на чужой базе)", () => {
    for (const url of [
      "postgresql://u:p@db.example.com:5432/anticore",
      "postgresql://u:p@10.0.0.5:5432/anticore",
      "postgresql://u:p@192.168.88.11:5432/anticore",
      "postgresql://u:p@localhost.evil.com:5432/anticore", // «localhost» только как часть чужого домена
      "postgresql://u:p@127.0.0.1.nip.io:5432/anticore",
      "not a url",
      "",
      undefined,
    ]) {
      expect(isLocalDatabaseUrl(url as string | undefined)).toBe(false);
    }
  });

  it("логин/пароль в строке подключения не обманывают проверку хоста", () => {
    expect(isLocalDatabaseUrl("postgresql://localhost:secret@db.example.com:5432/anticore")).toBe(false);
  });

  it("NODE_ENV=production блокирует запуск даже на локальной базе", () => {
    const local = "postgresql://u:p@localhost:5432/anticore";
    expect(refusalReason({ NODE_ENV: "production", DATABASE_URL: local })).toMatch(/production/);
    expect(refusalReason({ NODE_ENV: "development", DATABASE_URL: local })).toBeNull();
    expect(refusalReason({ DATABASE_URL: local })).toBeNull();
  });

  it("нелокальная база блокирует запуск с понятной причиной", () => {
    expect(refusalReason({ DATABASE_URL: "postgresql://u:p@db.example.com/anticore" })).toMatch(/не на локальную/);
    expect(refusalReason({})).toMatch(/не на локальную/);
  });
});

describe("сид тестовых сотрудников — состав и пароль", () => {
  it("все логины с префиксом test. (сид не трогает реальных сотрудников), без дублей и в нижнем регистре (как хранит приложение)", () => {
    const logins = TEST_STAFF.map((t) => t.login);
    expect(logins.every((l) => l.startsWith(TEST_LOGIN_PREFIX))).toBe(true);
    expect(new Set(logins).size).toBe(logins.length);
    expect(logins.every((l) => l === l.trim().toLowerCase())).toBe(true);
  });

  it("логины подходят под правило создания учётки в админке (латиница, цифры, . _ -, 3–64 символа)", () => {
    for (const t of TEST_STAFF) expect(t.login).toMatch(/^[A-Za-z0-9._-]{3,64}$/);
  });

  it("есть два админа, мастера по каждому филиалу, мастер на всех филиалах и заблокированный", () => {
    expect(TEST_STAFF.filter((t) => t.role === "ADMIN")).toHaveLength(2);
    const masters = TEST_STAFF.filter((t) => t.role === "MASTER" && !t.blocked);
    for (const branch of ["ZHUKOVSKY", "RAMENSKOYE", "KOLOMNA"]) {
      expect(masters.some((m) => m.locations.length === 1 && m.locations[0] === branch)).toBe(true);
    }
    expect(masters.some((m) => m.locations.length === 3)).toBe(true);
    expect(TEST_STAFF.filter((t) => t.blocked)).toHaveLength(1);
  });

  it("филиалы только из известных; у каждой учётки есть имя и описание", () => {
    for (const t of TEST_STAFF) {
      expect(t.fullName.length).toBeGreaterThan(1);
      expect(t.note.length).toBeGreaterThan(5);
      expect(t.locations.length).toBeGreaterThan(0);
      for (const l of t.locations) expect(["ZHUKOVSKY", "RAMENSKOYE", "KOLOMNA"]).toContain(l);
    }
  });

  it("пароль по умолчанию не короче 8 символов (как требует создание учётки), его можно переопределить окружением", () => {
    expect(TEST_PASSWORD.length).toBeGreaterThanOrEqual(8);
    expect(resolvePassword({})).toBe(TEST_PASSWORD);
    expect(resolvePassword({ TEST_STAFF_PASSWORD: "  my-own-pass-1  " })).toBe("my-own-pass-1");
    expect(() => resolvePassword({ TEST_STAFF_PASSWORD: "short" })).toThrow(/8 символов/);
    expect(resolvePassword({ TEST_STAFF_PASSWORD: "   " })).toBe(TEST_PASSWORD); // пустая строка — как «не задан»
  });
});
