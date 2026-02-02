// src/admin/admin-jwt.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
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

      // Добавляем информацию о пользователе в request
      request['admin'] = {
        id: validationResult.payload!.sub,
        role: validationResult.payload!.role,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Ошибка проверки авторизации');
    }
  }
}