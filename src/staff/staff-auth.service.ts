import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { StaffLoginDto } from "./dto/staff.dto";
import { StaffAuditAction, StaffAuditService } from "./staff-audit.service";
import { StaffTokenService } from "./staff-token.service";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const BAD_CREDENTIALS = "Неверный логин или пароль";
/** Хэш-пустышка: сравнение выполняется и для несуществующего логина, чтобы время ответа не выдавало его. */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: StaffTokenService,
    private readonly audit: StaffAuditService,
  ) {}

  async login(dto: StaffLoginDto, req: Request) {
    const login = normalizeLogin(dto.login);

    const since = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS);
    if ((await this.audit.countRecentFailures(login, since)) >= LOGIN_MAX_FAILURES) {
      throw new HttpException(
        "Слишком много неудачных попыток. Повторите через 15 минут",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const staff = await this.prisma.staff.findUnique({ where: { login } });
    const passwordOk = await bcrypt.compare(dto.password, staff?.passwordHash ?? DUMMY_HASH);

    if (!staff || !passwordOk) {
      await this.audit.log({
        action: StaffAuditAction.LOGIN_FAILED,
        actor: login,
        staffId: staff?.id,
        req,
        meta: { reason: staff ? "wrong_password" : "unknown_login" },
      });
      throw new UnauthorizedException(BAD_CREDENTIALS);
    }

    if (staff.blockedAt) {
      await this.audit.log({
        action: StaffAuditAction.LOGIN_FAILED,
        actor: login,
        staffId: staff.id,
        req,
        meta: { reason: "blocked" },
      });
      throw new ForbiddenException("Учётная запись заблокирована. Обратитесь к администратору");
    }

    await this.prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ action: StaffAuditAction.LOGIN, actor: staff.login, staffId: staff.id, req });

    return { token: this.tokens.sign(staff.id, staff.role), staff: toPublic(staff) };
  }
}

export function toPublic(staff: {
  id: number;
  login: string;
  fullName: string;
  role: string;
  locations: string[];
}) {
  return {
    id: staff.id,
    login: staff.login,
    fullName: staff.fullName,
    role: staff.role,
    locations: staff.locations,
  };
}
