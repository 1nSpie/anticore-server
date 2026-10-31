import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UsePipes, ValidationPipe } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { LoginDto } from "../auth/login.dto";
import { STAFF_LOGIN_RATE, StaffThrottle } from "../common/throttle";
import { SessionService } from "./session.service";
import { STAFF_COOKIE } from "./staff-jwt.guard";
import { STAFF_TOKEN_TTL_DAYS } from "./staff-token.service";

const ADMIN_COOKIE = "admin_token";
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

const cookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: isProd, sameSite: isProd ? ("none" as const) : ("lax" as const), path: "/" };
};

/** Токен из заголовка Authorization или из cookie (admin_token / staff_token). */
export function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[ADMIN_COOKIE] ?? req.cookies?.[STAFF_COOKIE];
}

@Controller("admin")
@StaffThrottle()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SessionController {
  constructor(private readonly session: SessionService) {}

  /** Единый вход для админа и мастера. 30 попыток / 15 мин с IP (цех = один IP); перебор логина режется отдельно: 5 неудач / 15 мин. */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ...STAFF_LOGIN_RATE } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.session.login(dto, req);
    // Cookie выдаём под тот токен, который выдали; чужую (если осталась от прошлой роли) убираем
    if (user.kind === "admin") {
      res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(), maxAge: ADMIN_TTL_MS });
      res.clearCookie(STAFF_COOKIE, cookieOptions());
    } else {
      res.cookie(STAFF_COOKIE, token, { ...cookieOptions(), maxAge: STAFF_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 });
      res.clearCookie(ADMIN_COOKIE, cookieOptions());
    }
    return {
      success: true,
      token, // фронт кладёт его в localStorage (ключ зависит от user.kind)
      role: user.role,
      kind: user.kind,
      user,
      message: "Авторизация успешна",
      timestamp: new Date().toISOString(),
    };
  }

  /** Кто вошёл и с какой ролью. По нему фронт решает, куда вести: в админку или в кабинет мастера. */
  @Get("me")
  me(@Req() req: Request) {
    return this.session.me(extractToken(req));
  }
}
