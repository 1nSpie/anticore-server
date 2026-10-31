// src/admin/admin-jwt.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffRole } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ENV_SUBJECT, AdminAuthService, staffIdFromSubject } from './admin-auth.service';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  /**
   * Env-админ проверяется синхронно (подпись + claims). Сотрудник с ролью ADMIN (`sub = staff:<id>`) — дополнительно по БД:
   * заблокированный, удалённый или разжалованный в мастера теряет доступ сразу, а не через 12 часов.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Проверяем заголовок Authorization (Bearer token)
    const authHeader = request.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // 2. Если нет в заголовке, проверяем куки
    if (!token) {
      token = request.cookies?.admin_token;
    }

    if (!token) {
      throw new UnauthorizedException('Требуется авторизация администратора');
    }

    try {
      // Верифицируем токен
      const validationResult = this.adminAuthService.verifyToken(token);
      
      if (!validationResult.isValid) {
        throw new UnauthorizedException(
          validationResult.error === 'Token expired'
            ? 'Сессия истекла'
            : 'Недействительная авторизация'
        );
      }

      const sub = validationResult.payload!.sub;
      const admin = { id: sub, role: validationResult.payload!.role } as { id: string; role: string; staffId?: number };

      if (sub === ADMIN_ENV_SUBJECT) {
        request['admin'] = admin;
        return true;
      }

      // Любой другой субъект, кроме staff:<id>, не принимаем: подпись верна, но кому выдан токен — неизвестно
      const staffId = staffIdFromSubject(sub);
      if (staffId === null || !this.prisma) throw new UnauthorizedException('Недействительная авторизация');
      return this.prisma.staff
        .findUnique({ where: { id: staffId }, select: { role: true, blockedAt: true } })
        .then((staff) => {
          if (!staff || staff.blockedAt || staff.role !== StaffRole.ADMIN) {
            throw new UnauthorizedException('Учётная запись недоступна');
          }
          request['admin'] = { ...admin, staffId };
          return true;
        });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Ошибка проверки авторизации');
    }
  }
}