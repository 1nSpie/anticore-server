// src/common/utils/cookie.utils.ts
import { Response, Request } from 'express';
import { ConfigService } from './config';


export class CookieUtils {
  private static configService = ConfigService.getInstance();

  /**
   * Устанавливает куку с токеном администратора
   */
  static setAdminToken(res: Response, token: string): void {
    const config = this.configService.getAll();
    const domain = process.env.COOKIE_DOMAIN || undefined;
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie(config.cookies.name, token, {
      httpOnly: config.cookies.httpOnly,
      secure: config.cookies.secure,
      sameSite: config.cookies.sameSite,
      maxAge: config.admin.sessionDuration,
      path: config.cookies.path,
      domain,
      ...(isProd && domain && { 
        sameSite: 'none' as const,
        secure: true,
      }),
    });
  }

  /**
   * Очищает куку с токеном администратора
   */
  static clearAdminToken(res: Response): void {
    const config = this.configService.getAll();
    const domain = process.env.COOKIE_DOMAIN || undefined;
    const isProd = process.env.NODE_ENV === 'production';

    res.clearCookie(config.cookies.name, {
      httpOnly: config.cookies.httpOnly,
      secure: config.cookies.secure,
      sameSite: config.cookies.sameSite,
      path: config.cookies.path,
      domain,
      ...(isProd && domain && { 
        sameSite: 'none' as const,
        secure: true,
      }),
    });
  }

  /**
   * Извлекает токен из запроса
   * Проверяет куки и заголовок Authorization
   */
  static extractTokenFromRequest(request: Request): string | null {
    const config = this.configService.getAll();
    
    // 1. Проверяем куки
    const cookies = request.cookies;
    if (cookies?.[config.cookies.name]) {
      return cookies[config.cookies.name];
    }

    // 2. Проверяем подписанные куки (если используется cookie-parser с секретом)
    const signedCookies = (request as any).signedCookies;
    if (signedCookies?.[config.cookies.name]) {
      return signedCookies[config.cookies.name];
    }

    // 3. Проверяем заголовок Authorization (для API запросов)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Базовая валидация токена
      if (token && token.length > 10) {
        return token;
      }
    }

    // 4. Проверяем query параметр (только для разработки)
    if (process.env.NODE_ENV !== 'production') {
      const token = request.query.token as string;
      if (token && token.length > 10) {
        return token;
      }
    }

    return null;
  }

  /**
   * Проверяет наличие валидной куки администратора
   */
  static hasAdminToken(request: Request): boolean {
    const token = this.extractTokenFromRequest(request);
    return !!token;
  }

  /**
   * Устанавливает куку с настройками
   */
  static setCookie(
    res: Response, 
    name: string, 
    value: string, 
    options: {
      maxAge?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: boolean | 'lax' | 'strict' | 'none';
      path?: string;
      domain?: string;
    } = {}
  ): void {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = options.domain || process.env.COOKIE_DOMAIN || undefined;

    const cookieOptions: any = {
      httpOnly: options.httpOnly ?? true,
      secure: options.secure ?? isProd,
      sameSite: options.sameSite ?? (isProd ? 'none' : 'lax'),
      maxAge: options.maxAge ?? 24 * 60 * 60 * 1000, // 1 день по умолчанию
      path: options.path ?? '/',
    };

    if (domain) {
      cookieOptions.domain = domain;
    }

    res.cookie(name, value, cookieOptions);
  }

  /**
   * Очищает куку
   */
  static clearCookie(
    res: Response, 
    name: string, 
    options: {
      path?: string;
      domain?: string;
    } = {}
  ): void {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = options.domain || process.env.COOKIE_DOMAIN || undefined;

    const clearOptions: any = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: options.path ?? '/',
    };

    if (domain) {
      clearOptions.domain = domain;
    }

    res.clearCookie(name, clearOptions);
  }

  /**
   * Получает значение куки по имени
   */
  static getCookie(request: Request, name: string): string | null {
    // Проверяем обычные куки
    if (request.cookies?.[name]) {
      return request.cookies[name];
    }

    // Проверяем подписанные куки
    const signedCookies = (request as any).signedCookies;
    if (signedCookies?.[name]) {
      return signedCookies[name];
    }

    return null;
  }

  /**
   * Создает безопасные настройки для кук в зависимости от окружения
   */
  static getCookieSecurityOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  } {
    const isProd = process.env.NODE_ENV === 'production';
    const hasCustomDomain = !!process.env.COOKIE_DOMAIN;

    return {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd && hasCustomDomain) ? 'none' : 'lax',
    };
  }
}

// Расширяем тип Request для поддержки signedCookies
declare module 'express' {
  interface Request {
    signedCookies?: Record<string, string>;
  }
}