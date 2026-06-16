import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Response } from "express";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../../prisma/prisma.service";
import { SmsService } from "../sms/sms.service";
import { normalizePhoneRu } from "../common/phone.util";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  safeCompareTokenHash,
} from "../common/crypto.util";
import { RegisterDto } from "./dto/register.dto";
import { VerifyRegistrationDto } from "./dto/verify-registration.dto";
import { CabinetLoginDto } from "./dto/cabinet-login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SmsPurpose } from "../../../generated/prisma/enums";

const COOKIE_NAME =
  process.env.CABINET_REFRESH_COOKIE_NAME?.trim() || "cabinet_refresh";

function jwtSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) {
    throw new Error("JWT_SECRET не задан в окружении");
  }
  return s;
}

function accessTtlSec(): number {
  const n = parseInt(process.env.CABINET_ACCESS_TTL_SEC ?? "900", 10);
  return Number.isFinite(n) && n > 60 ? n : 900;
}

function refreshTtlMs(): number {
  const days = parseFloat(process.env.CABINET_REFRESH_TTL_DAYS ?? "7");
  const d = Number.isFinite(days) && days > 0 ? days : 7;
  return Math.floor(d * 24 * 60 * 60 * 1000);
}

function randomSmsCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

@Injectable()
export class CabinetAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  getRefreshCookieName(): string {
    return COOKIE_NAME;
  }

  /** Регистрация: создаёт/обновляет ожидание и шлёт SMS с кодом. */
  async register(dto: RegisterDto, clientIp?: string) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException("Пароли не совпадают");
    }
    const phone = normalizePhoneRu(dto.phone);
    const existing = await this.prisma.cabinetUser.findUnique({
      where: { phone },
    });
    if (existing?.phoneVerified) {
      throw new BadRequestException("Этот номер уже зарегистрирован");
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const code = randomSmsCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const acceptedAt = new Date();

    await this.prisma.pendingRegistration.upsert({
      where: { phone },
      create: {
        phone,
        passwordHash,
        code,
        expiresAt,
        privacyPolicyAcceptedAt: acceptedAt,
        personalDataConsentAt: acceptedAt,
        termsAcceptedAt: acceptedAt,
      },
      update: {
        passwordHash,
        code,
        expiresAt,
        privacyPolicyAcceptedAt: acceptedAt,
        personalDataConsentAt: acceptedAt,
        termsAcceptedAt: acceptedAt,
      },
    });

    await this.sms.sendCode(phone, `Код подтверждения Anticore: ${code}`, {
      clientIp,
    });

    return {
      message: "Код подтверждения отправлен по SMS",
      phone,
    };
  }

  /** Подтверждение SMS — создание аккаунта и выдача токенов. */
  async verifyRegistration(
    dto: VerifyRegistrationDto,
    res: Response,
  ): Promise<Record<string, unknown>> {
    const phone = normalizePhoneRu(dto.phone);
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { phone },
    });
    if (!pending) {
      throw new BadRequestException("Сначала запросите регистрацию");
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRegistration.delete({ where: { phone } });
      throw new BadRequestException("Код истёк, запросите новый");
    }
    if (pending.code !== dto.code.trim()) {
      throw new BadRequestException("Неверный код");
    }

    await this.prisma.pendingRegistration.delete({ where: { phone } });

    const user = await this.prisma.cabinetUser.upsert({
      where: { phone },
      create: {
        phone,
        passwordHash: pending.passwordHash,
        phoneVerified: true,
        privacyPolicyAcceptedAt: pending.privacyPolicyAcceptedAt,
        personalDataConsentAt: pending.personalDataConsentAt,
        termsAcceptedAt: pending.termsAcceptedAt,
      },
      update: {
        passwordHash: pending.passwordHash,
        phoneVerified: true,
        blocked: false,
        blockedAt: null,
        privacyPolicyAcceptedAt: pending.privacyPolicyAcceptedAt,
        personalDataConsentAt: pending.personalDataConsentAt,
        termsAcceptedAt: pending.termsAcceptedAt,
      },
    });

    await this.prisma.notificationSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    return this.issueTokensAndSetCookie(user, res);
  }

  async login(dto: CabinetLoginDto, res: Response) {
    const phone = normalizePhoneRu(dto.phone);
    const user = await this.prisma.cabinetUser.findUnique({
      where: { phone },
    });
    if (!user) {
      throw new UnauthorizedException("Неверный телефон или пароль");
    }
    if (!user.phoneVerified) {
      throw new ForbiddenException(
        "Подтвердите регистрацию по SMS (код из смс)",
      );
    }
    if (user.blocked) {
      throw new ForbiddenException("Аккаунт заблокирован");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Неверный телефон или пароль");
    }

    return this.issueTokensAndSetCookie(user, res);
  }

  /**
   * Обновление access по refresh из httpOnly cookie.
   * Ротация refresh: старый отзывается, выдаётся новый.
   */
  async refresh(refreshCookie: string | undefined, res: Response) {
    const parsed = this.parseRefreshCookie(refreshCookie);
    if (!parsed) {
      throw new UnauthorizedException("Сессия не найдена");
    }
    const { id, secret } = parsed;
    const row = await this.prisma.userRefreshToken.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!row || row.expiresAt < new Date()) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException("Сессия истекла");
    }
    if (!safeCompareTokenHash(row.tokenHash, secret)) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException("Недействительная сессия");
    }
    try {
      await this.assertActiveCabinetUser(row.user.id);
    } catch (e) {
      await this.prisma.userRefreshToken.delete({ where: { id } });
      this.clearRefreshCookie(res);
      throw e;
    }

    await this.prisma.userRefreshToken.delete({ where: { id } });
    return this.issueTokensAndSetCookie(row.user, res);
  }

  async logout(refreshCookie: string | undefined, res: Response) {
    const parsed = this.parseRefreshCookie(refreshCookie);
    if (parsed) {
      await this.prisma.userRefreshToken
        .delete({ where: { id: parsed.id } })
        .catch(() => undefined);
    }
    this.clearRefreshCookie(res);
    return { message: "Вы вышли из аккаунта" };
  }

  async forgotPassword(dto: ForgotPasswordDto, clientIp?: string) {
    const phone = normalizePhoneRu(dto.phone);
    const user = await this.prisma.cabinetUser.findUnique({ where: { phone } });
    if (!user?.phoneVerified) {
      // Не раскрываем наличие номера
      return { message: "Если номер зарегистрирован, код отправлен по SMS" };
    }
    const code = randomSmsCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.smsCode.updateMany({
      where: {
        phone,
        purpose: SmsPurpose.PASSWORD_RESET,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    await this.prisma.smsCode.create({
      data: { phone, purpose: SmsPurpose.PASSWORD_RESET, code, expiresAt },
    });
    await this.sms.sendCode(phone, `Код восстановления пароля Anticore: ${code}`, {
      clientIp,
    });
    return { message: "Если номер зарегистрирован, код отправлен по SMS" };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException("Пароли не совпадают");
    }
    const phone = normalizePhoneRu(dto.phone);
    const row = await this.prisma.smsCode.findFirst({
      where: {
        phone,
        purpose: SmsPurpose.PASSWORD_RESET,
        consumedAt: null,
      },
      orderBy: { id: "desc" },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new BadRequestException("Код недействителен или истёк");
    }
    if (row.code !== dto.code.trim()) {
      throw new BadRequestException("Неверный код");
    }
    const user = await this.prisma.cabinetUser.findUnique({ where: { phone } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.$transaction([
      this.prisma.smsCode.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.cabinetUser.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.userRefreshToken.deleteMany({ where: { userId: user.id } }),
    ]);
    return { message: "Пароль обновлён. Войдите снова." };
  }

  signAccessToken(userId: number): { token: string; expiresIn: number } {
    const expiresIn = accessTtlSec();
    const token = jwt.sign(
      { sub: String(userId), typ: "cabinet_access" },
      jwtSecret(),
      { expiresIn },
    );
    return { token, expiresIn };
  }

  verifyAccessToken(
    bearer: string | undefined,
  ): { userId: number } | null {
    if (!bearer?.startsWith("Bearer ")) return null;
    const raw = bearer.slice(7);
    try {
      const payload = jwt.verify(raw, jwtSecret()) as {
        sub: string;
        typ?: string;
      };
      if (payload.typ !== "cabinet_access") return null;
      const userId = Number(payload.sub);
      if (!Number.isFinite(userId)) return null;
      return { userId };
    } catch {
      return null;
    }
  }

  /** Проверка, что пользователь существует и может пользоваться кабинетом. */
  async assertActiveCabinetUser(userId: number): Promise<void> {
    const user = await this.prisma.cabinetUser.findUnique({
      where: { id: userId },
      select: { blocked: true, phoneVerified: true },
    });
    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }
    if (!user.phoneVerified) {
      throw new ForbiddenException(
        "Подтвердите регистрацию по SMS (код из смс)",
      );
    }
    if (user.blocked) {
      throw new ForbiddenException("Аккаунт заблокирован");
    }
  }

  /** Отзыв всех refresh-сессий (выход на всех устройствах). */
  async revokeAllSessions(userId: number): Promise<void> {
    await this.prisma.userRefreshToken.deleteMany({ where: { userId } });
  }

  private parseRefreshCookie(
    cookie: string | undefined,
  ): { id: string; secret: string } | null {
    if (!cookie) return null;
    const i = cookie.indexOf(":");
    if (i < 1 || i === cookie.length - 1) return null;
    return { id: cookie.slice(0, i), secret: cookie.slice(i + 1) };
  }

  private clearRefreshCookie(res: Response) {
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      path: "/",
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    });
  }

  private setRefreshCookie(res: Response, id: string, secret: string) {
    const isProd = process.env.NODE_ENV === "production";
    const maxAge = refreshTtlMs();
    res.cookie(COOKIE_NAME, `${id}:${secret}`, {
      httpOnly: true,
      path: "/",
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge,
    });
  }

  private async issueTokensAndSetCookie(
    user: { id: number; phone: string },
    res: Response,
  ) {
    const { token: accessToken, expiresIn } = this.signAccessToken(user.id);
    const secret = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(secret);
    const expiresAt = new Date(Date.now() + refreshTtlMs());
    const row = await this.prisma.userRefreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    this.setRefreshCookie(res, row.id, secret);
    return {
      accessToken,
      expiresIn,
      tokenType: "Bearer",
      user: { id: user.id, phone: user.phone },
    };
  }

  /** Отзыв всех refresh, кроме указанного id сессии (после смены пароля). */
  async revokeRefreshExcept(userId: number, exceptTokenId: string | null) {
    if (exceptTokenId) {
      await this.prisma.userRefreshToken.deleteMany({
        where: {
          userId,
          NOT: { id: exceptTokenId },
        },
      });
    } else {
      await this.revokeAllSessions(userId);
    }
  }

  parseRefreshId(refreshCookie: string | undefined): string | null {
    return this.parseRefreshCookie(refreshCookie)?.id ?? null;
  }
}
