import { ForbiddenException, HttpException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { LOGIN_MAX_FAILURES, StaffAuthService } from "./staff-auth.service";

describe("StaffAuthService", () => {
  const hash = bcrypt.hashSync("correct-horse-1", 4);
  let rows: Record<string, any>;
  let prisma: any;
  let audit: any;
  let failures: number;
  let svc: StaffAuthService;

  beforeEach(() => {
    rows = {
      ivan: { id: 7, login: "ivan", role: "MASTER", passwordHash: hash, blockedAt: null },
      lock: { id: 9, login: "lock", role: "MASTER", passwordHash: hash, blockedAt: new Date() },
    };
    failures = 0;
    prisma = {
      staff: {
        findUnique: jest.fn(async ({ where }) => rows[where.login] ?? null),
        update: jest.fn(async () => undefined),
      },
    };
    audit = { log: jest.fn(async () => undefined), countRecentFailures: jest.fn(async () => failures) };
    svc = new StaffAuthService(prisma, audit);
  });

  it("верный пароль: возвращает сотрудника, обновляет lastLoginAt и пишет LOGIN", async () => {
    const staff = await svc.authenticate("  IVAN ", "correct-horse-1", {} as any);
    expect(staff.id).toBe(7);
    expect(prisma.staff.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { lastLoginAt: expect.any(Date) } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "LOGIN", staffId: 7 }));
  });

  it("неверный пароль и неизвестный логин — одинаковый 401, причина — только в журнале", async () => {
    const wrong: any = await svc.authenticate("ivan", "nope", {} as any).catch((e) => e);
    const unknown: any = await svc.authenticate("ghost", "nope", {} as any).catch((e) => e);
    expect(wrong).toBeInstanceOf(UnauthorizedException);
    expect(unknown).toBeInstanceOf(UnauthorizedException);
    expect(wrong.message).toBe(unknown.message);
    const reasons = audit.log.mock.calls.map((c: any[]) => c[0].meta.reason);
    expect(reasons).toEqual(["wrong_password", "unknown_login"]);
  });

  it("заблокированная учётка: 403 только при верном пароле, неудача пишется как blocked", async () => {
    await expect(svc.authenticate("lock", "correct-horse-1", {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "LOGIN_FAILED", meta: { reason: "blocked" } }));
    expect(prisma.staff.update).not.toHaveBeenCalled();
    audit.log.mockClear();
    await expect(svc.authenticate("lock", "wrong", {} as any)).rejects.toBeInstanceOf(UnauthorizedException); // чужой не узнает, что учётка заблокирована
  });

  it(`после ${LOGIN_MAX_FAILURES} неудач за 15 минут вход закрыт (429) — и для верного пароля`, async () => {
    failures = LOGIN_MAX_FAILURES;
    await expect(svc.authenticate("ivan", "correct-horse-1", {} as any)).rejects.toBeInstanceOf(HttpException);
    await expect(svc.authenticate("ivan", "correct-horse-1", {} as any)).rejects.toMatchObject({ status: 429 });
    expect(prisma.staff.findUnique).not.toHaveBeenCalled();
  });

  it("на 4 неудачах ещё можно войти", async () => {
    failures = LOGIN_MAX_FAILURES - 1;
    await expect(svc.authenticate("ivan", "correct-horse-1", {} as any)).resolves.toBeDefined();
  });
});
