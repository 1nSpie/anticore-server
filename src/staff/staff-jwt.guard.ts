import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { StaffRole } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ALLOW_WITHOUT_ACK_KEY } from "./regulation-ack.decorator";
import { STAFF_ROLES_KEY } from "./roles.decorator";
import { StaffTokenService } from "./staff-token.service";

export interface StaffPrincipal {
  id: number;
  login: string;
  fullName: string;
  role: StaffRole;
  locations: string[];
}

export const STAFF_COOKIE = "staff_token";
export const REGULATION_ACK_REQUIRED = "REGULATION_ACK_REQUIRED";

/**
 * Пускает только сотрудника с действующим токеном; блокировка действует сразу (проверка по БД).
 * Если на методе/контроллере задан `@Roles(...)`, роль сотрудника должна входить в список.
 */
@Injectable()
export class StaffJwtGuard implements CanActivate {
  constructor(
    private readonly tokens: StaffTokenService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.[STAFF_COOKIE];
    if (!token) throw new UnauthorizedException("Требуется авторизация сотрудника");

    const payload = this.tokens.verify(token);
    if (!payload) throw new UnauthorizedException("Недействительная авторизация");

    const staff = await this.prisma.staff.findUnique({ where: { id: Number(payload.sub) } });
    if (!staff || staff.blockedAt) throw new UnauthorizedException("Учётная запись недоступна");

    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(STAFF_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(staff.role)) {
      throw new ForbiddenException("Недостаточно прав");
    }

    // Мастер, не ознакомившийся с актуальной версией регламента, дальше экрана регламента не проходит (D17)
    if (staff.role === StaffRole.MASTER) {
      const allowed = this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_WITHOUT_ACK_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        const state = await this.prisma.regulationState.findUnique({ where: { id: 1 }, select: { version: true } });
        if (state && staff.regulationAckVersion < state.version) {
          throw new ForbiddenException({
            statusCode: 403,
            code: REGULATION_ACK_REQUIRED,
            message: "Ознакомьтесь с обновлённым регламентом, чтобы продолжить работу",
          });
        }
      }
    }

    req["staff"] = {
      id: staff.id,
      login: staff.login,
      fullName: staff.fullName,
      role: staff.role,
      locations: staff.locations,
    } satisfies StaffPrincipal;
    return true;
  }
}
