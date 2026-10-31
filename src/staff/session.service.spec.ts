import { HttpException, UnauthorizedException } from "@nestjs/common";
import { AdminAuthService } from "../auth/admin-auth.service";
import { SessionService } from "./session.service";
import { StaffAuthService } from "./staff-auth.service";
import { StaffTokenService } from "./staff-token.service";

const ENV_KEYS = ["ADMIN_LOGIN", "ADMIN_PASSWORD", "ADMIN_JWT_SECRET", "STAFF_JWT_SECRET", "JWT_SECRET"];

describe("SessionService — единый вход и «кто я»", () => {
  const saved: Record<string, string | undefined> = {};
  let adminAuth: AdminAuthService;
  let staffTokens: StaffTokenService;
  let staffRows: Record<number, any>;
  let staffAuth: any;
  let audit: any;
  let prisma: any;
  let svc: SessionService;

  beforeEach(() => {
    ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; });
    process.env.ADMIN_LOGIN = "boss";
    process.env.ADMIN_PASSWORD = "env-password-1";
    process.env.ADMIN_JWT_SECRET = "admin-secret-for-tests";
    process.env.STAFF_JWT_SECRET = "staff-secret-for-tests";
    adminAuth = new AdminAuthService();
    staffTokens = new StaffTokenService();
    staffRows = {
      7: { id: 7, login: "ivan", fullName: "Иван Мастер", role: "MASTER", locations: ["KOLOMNA"], blockedAt: null },
      8: { id: 8, login: "anna", fullName: "Анна Админ", role: "ADMIN", locations: [], blockedAt: null },
    };
    staffAuth = {
      assertNotLocked: jest.fn(async () => undefined),
      authenticate: jest.fn(async (login: string) => {
        const row = Object.values(staffRows).find((r: any) => r.login === login.trim().toLowerCase());
        if (!row) throw new UnauthorizedException("Неверный логин или пароль");
        return row;
      }),
    } as unknown as StaffAuthService;
    audit = { log: jest.fn(async () => undefined) };
    prisma = { staff: { findUnique: jest.fn(async ({ where }) => staffRows[where.id] ?? null) } };
    svc = new SessionService(adminAuth, staffAuth, staffTokens, audit, prisma);
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  });

  describe("login", () => {
    it("администратор из env: токен админки (sub=admin), роль ADMIN, запись в журнале", async () => {
      const r = await svc.login({ login: "boss", password: "env-password-1" }, {} as any);
      expect(r.user).toMatchObject({ role: "ADMIN", kind: "admin", id: null });
      const check = adminAuth.verifyToken(r.token);
      expect(check.isValid).toBe(true);
      expect(check.payload?.sub).toBe("admin");
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "LOGIN", meta: { kind: "env-admin" } }));
      expect(staffAuth.authenticate).not.toHaveBeenCalled();
    });

    it("мастер: токен кабинета (а не админки), роль MASTER", async () => {
      const r = await svc.login({ login: "Ivan", password: "x" }, {} as any);
      expect(r.user).toMatchObject({ role: "MASTER", kind: "staff", id: 7, fullName: "Иван Мастер", locations: ["KOLOMNA"] });
      expect(staffTokens.verify(r.token)).toMatchObject({ sub: "7", role: "MASTER" });
      expect(adminAuth.verifyToken(r.token).isValid).toBe(false); // токен мастера не открывает админку
    });

    it("сотрудник с ролью ADMIN получает токен админки, привязанный к его учётке (staff:<id>)", async () => {
      const r = await svc.login({ login: "anna", password: "x" }, {} as any);
      expect(r.user).toMatchObject({ role: "ADMIN", kind: "admin", id: 8 });
      const check = adminAuth.verifyToken(r.token);
      expect(check.isValid).toBe(true);
      expect(check.payload?.sub).toBe("staff:8");
      expect(staffTokens.verify(r.token)).toBeNull(); // это не токен кабинета мастера
    });

    it("блокировка по логину проверяется ДО пароля: при блокировке не пускает даже верный пароль env-админа", async () => {
      staffAuth.assertNotLocked.mockRejectedValueOnce(new HttpException("Слишком много неудачных попыток", 429));
      await expect(svc.login({ login: "boss", password: "env-password-1" }, {} as any)).rejects.toMatchObject({ status: 429 });
      expect(audit.log).not.toHaveBeenCalled();
      expect(staffAuth.authenticate).not.toHaveBeenCalled();
    });

    it("проверка блокировки идёт по нормализованному логину (регистр и пробелы не помогают обойти)", async () => {
      await svc.login({ login: "  IVAN ", password: "x" }, {} as any);
      expect(staffAuth.assertNotLocked).toHaveBeenCalledWith("ivan");
    });

    it("неверный пароль env-админа уходит в проверку сотрудников и заканчивается 401 (неудача попадёт в журнал там)", async () => {
      await expect(svc.login({ login: "boss", password: "wrong" }, {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(staffAuth.authenticate).toHaveBeenCalledWith("boss", "wrong", expect.anything());
    });

    it("сообщение об ошибке одинаково для неизвестного логина и неверного пароля (не выдаём, что логин существует)", async () => {
      const e1: any = await svc.login({ login: "nobody", password: "x" }, {} as any).catch((e) => e);
      expect(e1.message).toBe("Неверный логин или пароль");
    });
  });

  describe("me", () => {
    const adminToken = (sub: string) => adminAuth.createToken(sub);

    it("токен env-админа → ADMIN без обращения к БД", async () => {
      const u = await svc.me(adminToken("admin"));
      expect(u).toMatchObject({ role: "ADMIN", kind: "admin", id: null });
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    it("токен сотрудника-админа → его данные; заблокированный, удалённый или ставший мастером → 401", async () => {
      expect(await svc.me(adminToken("staff:8"))).toMatchObject({ role: "ADMIN", id: 8, fullName: "Анна Админ" });
      for (const patch of [{ blockedAt: new Date() }, { role: "MASTER" }, null]) {
        staffRows[8] = patch === null ? undefined : { ...staffRows[8], ...patch };
        await expect(svc.me(adminToken("staff:8"))).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });

    it("токен мастера → MASTER; заблокированный → 401", async () => {
      expect(await svc.me(staffTokens.sign(7, "MASTER"))).toMatchObject({ role: "MASTER", kind: "staff", id: 7 });
      staffRows[7].blockedAt = new Date();
      await expect(svc.me(staffTokens.sign(7, "MASTER"))).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("старый токен кабинета у сотрудника с ролью ADMIN недействителен — нужен вход заново", async () => {
      await expect(svc.me(staffTokens.sign(8, "ADMIN"))).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("нет токена, мусор и токен с чужим секретом → 401", async () => {
      await expect(svc.me(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(svc.me("garbage")).rejects.toBeInstanceOf(UnauthorizedException);
      const jwt = require("jsonwebtoken");
      await expect(svc.me(jwt.sign({ sub: "admin", role: "admin", typ: "admin_access" }, "other-secret", { audience: "anticore-admin", issuer: "anticore-server" }))).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
