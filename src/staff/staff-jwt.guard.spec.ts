import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AdminAuthService } from "../auth/admin-auth.service";
import { AllowWithoutRegulationAck } from "./regulation-ack.decorator";
import { Roles } from "./roles.decorator";
import { StaffJwtGuard } from "./staff-jwt.guard";
import { StaffTokenService } from "./staff-token.service";

function ctx(token: string | undefined, handler: object = () => undefined): ExecutionContext {
  const req: any = { headers: token ? { authorization: `Bearer ${token}` } : {}, cookies: {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => class {},
    req,
  } as unknown as ExecutionContext & { req: any };
}

describe("StaffJwtGuard", () => {
  const OLD = { ...process.env };
  let tokens: StaffTokenService;
  let staffRow: any;
  let regState: any;
  let guard: StaffJwtGuard;

  beforeEach(() => {
    process.env.STAFF_JWT_SECRET = "staff-secret-for-tests";
    process.env.ADMIN_JWT_SECRET = "staff-secret-for-tests"; // намеренно общий — границу держат aud/typ
    tokens = new StaffTokenService();
    staffRow = { id: 7, login: "ivan", fullName: "Иван", role: "MASTER", locations: ["ZHUKOVSKY"], blockedAt: null, regulationAckVersion: 0 };
    regState = null; // регламент ещё не публиковался
    const prisma: any = {
      staff: { findUnique: jest.fn(async () => staffRow) },
      regulationState: { findUnique: jest.fn(async () => regState) },
    };
    guard = new StaffJwtGuard(tokens, prisma, new Reflector());
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  it("пускает активного сотрудника и кладёт его в request", async () => {
    const c: any = ctx(tokens.sign(7, "MASTER"));
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(c.req.staff).toMatchObject({ id: 7, role: "MASTER" });
  });

  it("без токена → 401", async () => {
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("токен админки не подходит сотруднику", async () => {
    const adminToken = new AdminAuthService().createToken();
    await expect(guard.canActivate(ctx(adminToken))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("токен сотрудника не открывает админку", () => {
    const res = new AdminAuthService().verifyToken(tokens.sign(7, "ADMIN"));
    expect(res.isValid).toBe(false);
  });

  it("заблокированный сотрудник отсекается сразу, даже с живым токеном", async () => {
    staffRow.blockedAt = new Date();
    await expect(guard.canActivate(ctx(tokens.sign(7, "MASTER")))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("удалённый сотрудник → 401", async () => {
    staffRow = null;
    await expect(guard.canActivate(ctx(tokens.sign(7, "MASTER")))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("@Roles: мастер не проходит на эндпоинт админа; роль берётся из БД, а не из токена", async () => {
    class H {
      @Roles("ADMIN")
      handler() {}
    }
    const handler = H.prototype.handler;
    // токен заявляет ADMIN, но в БД сотрудник — мастер
    await expect(guard.canActivate(ctx(tokens.sign(7, "ADMIN"), handler))).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe("ознакомление с регламентом (D17)", () => {
    class H {
      plain() {}
      @AllowWithoutRegulationAck()
      regulation() {}
    }
    const mk = (fn: () => void) => ctx(tokens.sign(7, "MASTER"), fn);

    it("регламент ещё не публиковался — работа не блокируется", async () => {
      await expect(guard.canActivate(mk(H.prototype.plain))).resolves.toBe(true);
    });

    it("опубликована версия 2, мастер знаком с 1 — все обычные эндпоинты закрыты (403, код для фронта)", async () => {
      regState = { version: 2 };
      staffRow.regulationAckVersion = 1;
      const err: any = await guard.canActivate(mk(H.prototype.plain)).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.getResponse()).toMatchObject({ code: "REGULATION_ACK_REQUIRED" });
    });

    it("но экран регламента (помечен @AllowWithoutRegulationAck) открыт", async () => {
      regState = { version: 2 };
      staffRow.regulationAckVersion = 1;
      await expect(guard.canActivate(mk(H.prototype.regulation))).resolves.toBe(true);
    });

    it("после ознакомления с актуальной версией доступ возвращается", async () => {
      regState = { version: 2 };
      staffRow.regulationAckVersion = 2;
      await expect(guard.canActivate(mk(H.prototype.plain))).resolves.toBe(true);
    });

    it("новый мастер (версия 0) при опубликованном регламенте тоже обязан ознакомиться", async () => {
      regState = { version: 1 };
      await expect(guard.canActivate(mk(H.prototype.plain))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("сотрудник-админ регламентом не блокируется", async () => {
      regState = { version: 5 };
      staffRow.role = "ADMIN";
      await expect(guard.canActivate(ctx(tokens.sign(7, "ADMIN"), H.prototype.plain))).resolves.toBe(true);
    });
  });
});
