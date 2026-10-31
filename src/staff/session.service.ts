import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { StaffRole } from "../../generated/prisma/client";
import { ADMIN_ENV_SUBJECT, AdminAuthService, staffIdFromSubject } from "../auth/admin-auth.service";
import { LoginDto } from "../auth/login.dto";
import { PrismaService } from "../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService } from "./staff-audit.service";
import { StaffAuthService, normalizeLogin } from "./staff-auth.service";
import { StaffTokenService } from "./staff-token.service";

/** Что фронту нужно знать о вошедшем: роль определяет, какой раздел открыть (админка или кабинет мастера). */
export interface SessionUser {
  role: "ADMIN" | "MASTER";
  /** Какой токен выдан: `admin` — для `/crm/*`, `staff` — для `/staff/*`. */
  kind: "admin" | "staff";
  id: number | null;
  login: string;
  fullName: string;
  locations: string[];
}

export interface SessionResult {
  token: string;
  user: SessionUser;
}

export const ENV_ADMIN_USER: SessionUser = { role: "ADMIN", kind: "admin", id: null, login: "admin", fullName: "Администратор", locations: [] };

/**
 * Единый вход (`POST /admin/login`) и «кто я» (`GET /admin/me`).
 * Роль определяется по учётной записи: администратор (env или сотрудник с ролью ADMIN) получает токен админки,
 * мастер — токен кабинета мастера. Раздел, который откроется, выбирает фронт по `user.role`.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly staffAuth: StaffAuthService,
    private readonly staffTokens: StaffTokenService,
    private readonly audit: StaffAuditService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto, req: Request): Promise<SessionResult> {
    const login = normalizeLogin(dto.login);

    // Блокировка перебора действует на любой логин — и сотрудника, и env-админа
    await this.staffAuth.assertNotLocked(login);

    if (this.adminAuth.validateCredentials(dto.login, dto.password)) {
      await this.audit.log({ action: StaffAuditAction.LOGIN, actor: login, req, meta: { kind: "env-admin" } });
      return { token: this.adminAuth.createToken(ADMIN_ENV_SUBJECT), user: ENV_ADMIN_USER };
    }

    const staff = await this.staffAuth.authenticate(dto.login, dto.password, req);
    const user = toSessionUser(staff);
    return {
      // Администратор-сотрудник работает в админке тем же токеном, что и env-админ, но привязанным к его учётке
      token: staff.role === StaffRole.ADMIN ? this.adminAuth.createToken(`staff:${staff.id}`) : this.staffTokens.sign(staff.id, staff.role),
      user,
    };
  }

  /** Кто владелец токена (любого из двух видов). Недействительный, истёкший, заблокированный — 401. */
  async me(token: string | undefined): Promise<SessionUser> {
    if (!token) throw new UnauthorizedException("Требуется авторизация");

    const admin = this.adminAuth.verifyToken(token);
    if (admin.isValid && admin.payload) {
      if (admin.payload.sub === ADMIN_ENV_SUBJECT) return ENV_ADMIN_USER;
      const id = staffIdFromSubject(admin.payload.sub);
      const staff = id === null ? null : await this.prisma.staff.findUnique({ where: { id } });
      if (!staff || staff.blockedAt || staff.role !== StaffRole.ADMIN) throw new UnauthorizedException("Учётная запись недоступна");
      return toSessionUser(staff);
    }

    const payload = this.staffTokens.verify(token);
    if (payload) {
      const staff = await this.prisma.staff.findUnique({ where: { id: Number(payload.sub) } });
      // Токен кабинета годится только мастеру: сотруднику с ролью ADMIN нужен админский токен — пусть войдёт заново
      if (!staff || staff.blockedAt || staff.role !== StaffRole.MASTER) throw new UnauthorizedException("Учётная запись недоступна");
      return toSessionUser(staff);
    }

    throw new UnauthorizedException("Недействительная авторизация");
  }
}

function toSessionUser(staff: { id: number; login: string; fullName: string; role: StaffRole; locations: string[] }): SessionUser {
  return {
    role: staff.role === StaffRole.ADMIN ? "ADMIN" : "MASTER",
    kind: staff.role === StaffRole.ADMIN ? "admin" : "staff",
    id: staff.id,
    login: staff.login,
    fullName: staff.fullName,
    locations: staff.locations,
  };
}
