import * as bcrypt from 'bcrypt';

export interface AdminConfig {
  admin: {
    login: string;
    password: string;
    hashedPassword: string;
    sessionDuration: number;
  };
  jwt: {
    secret: string;
    algorithm: 'HS256';
    issuer: string;
    audience: string;
  };
  cookies: {
    name: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
  };
  security: {
    maxLoginAttempts: number;
    blockDuration: number;
    attemptWindow: number;
  };
}

export class ConfigService {
  private static instance: ConfigService;
  private config: AdminConfig;

  private constructor() {
    // Хэшируем пароль один раз при инициализации
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(adminPassword, saltRounds);

    this.config = {
      admin: {
        login: process.env.ADMIN_LOGIN || 'admin',
        password: adminPassword,
        hashedPassword,
        sessionDuration: parseInt(process.env.ADMIN_SESSION_DURATION || '12', 10) * 60 * 60 * 1000,
      },
      jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
        algorithm: 'HS256',
        issuer: 'anticore-admin',
        audience: 'anticore-admin-panel',
      },
      cookies: {
        name: 'login_token',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      },
      security: {
        maxLoginAttempts: 5,
        blockDuration: 15 * 60 * 1000, // 15 минут
        attemptWindow: 30 * 60 * 1000, // 30 минут
      },
    };
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get<T = any>(key: string): T {
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      value = value[k];
      if (value === undefined) {
        throw new Error(`Config key '${key}' not found`);
      }
    }

    return value;
  }

  getAll(): AdminConfig {
    return { ...this.config };
  }
}