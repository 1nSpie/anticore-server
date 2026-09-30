// src/admin/admin-auth.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import * as jwt from 'jsonwebtoken';

/** Токен админки. Отличается от токена ЛК (`typ: "cabinet_access"`) и ролью, и audience. */
interface JwtPayload {
  sub: string;
  role: 'admin';
  typ: 'admin_access';
  iat: number;
  exp: number;
}

export const ADMIN_JWT_AUDIENCE = 'anticore-admin';
export const ADMIN_JWT_ISSUER = 'anticore-server';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly adminLogin = process.env.ADMIN_LOGIN?.trim();
  private readonly adminPassword = process.env.ADMIN_PASSWORD;
  private readonly jwtSecret: string | undefined;

  constructor() {
    const dedicated = process.env.ADMIN_JWT_SECRET?.trim();
    if (dedicated) {
      this.jwtSecret = dedicated;
    } else {
      this.jwtSecret = process.env.JWT_SECRET?.trim();
      this.logger.warn(
        'ADMIN_JWT_SECRET не задан — токены админки подписываются общим JWT_SECRET. Задайте отдельный секрет.',
      );
    }
  }

  validateCredentials(login: string, password: string): boolean {
    if (!this.adminLogin || !this.adminPassword) return false;
    // Сравниваем оба поля всегда, чтобы время ответа не зависело от того, какое не совпало.
    const loginOk = safeEqual(login, this.adminLogin);
    const passwordOk = safeEqual(password, this.adminPassword);
    return loginOk && passwordOk;
  }

  createToken(): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: 'admin',
      role: 'admin',
      typ: 'admin_access',
    };

    return jwt.sign(payload, this.requireSecret(), {
      expiresIn: '12h',
      audience: ADMIN_JWT_AUDIENCE,
      issuer: ADMIN_JWT_ISSUER,
    });
  }

  verifyToken(token: string): { isValid: boolean; payload?: JwtPayload; error?: string } {
    try {
      const payload = jwt.verify(token, this.requireSecret(), {
        audience: ADMIN_JWT_AUDIENCE,
        issuer: ADMIN_JWT_ISSUER,
      }) as JwtPayload;
      // Подписи недостаточно: токен ЛК подписан тем же секретом, если ADMIN_JWT_SECRET не задан.
      if (payload.role !== 'admin' || payload.typ !== 'admin_access') {
        return { isValid: false, error: 'Invalid token' };
      }
      return { isValid: true, payload };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { isValid: false, error: 'Token expired' };
      }
      return { isValid: false, error: 'Invalid token' };
    }
  }

  private requireSecret(): string {
    if (!this.jwtSecret) {
      throw new Error('ADMIN_JWT_SECRET / JWT_SECRET не задан');
    }
    return this.jwtSecret;
  }
}
