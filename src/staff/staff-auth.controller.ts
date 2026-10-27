import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { STAFF_LOGIN_RATE, StaffThrottle } from "../common/throttle";
import { Request, Response } from "express";
import { StaffLoginDto } from "./dto/staff.dto";
import { StaffAuditAction, StaffAuditService } from "./staff-audit.service";
import { StaffAuthService, toPublic } from "./staff-auth.service";
import { AllowWithoutRegulationAck } from "./regulation-ack.decorator";
import { STAFF_COOKIE, StaffJwtGuard, StaffPrincipal } from "./staff-jwt.guard";
import { STAFF_TOKEN_TTL_DAYS } from "./staff-token.service";

const cookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    path: "/",
  };
};

@Controller("staff/auth")
@StaffThrottle()
@AllowWithoutRegulationAck()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StaffAuthController {
  constructor(
    private readonly auth: StaffAuthService,
    private readonly audit: StaffAuditService,
  ) {}

  /** 30 попыток / 15 мин с IP (цех = один IP); перебор логина режется отдельно в сервисе: 5 неудач / 15 мин. */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ...STAFF_LOGIN_RATE } })
  async login(
    @Body() dto: StaffLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, staff } = await this.auth.login(dto, req);
    res.cookie(STAFF_COOKIE, token, {
      ...cookieOptions(),
      maxAge: STAFF_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
    return { token, staff };
  }

  @Get("me")
  @UseGuards(StaffJwtGuard)
  me(@Req() req: Request) {
    return toPublic(req["staff"] as StaffPrincipal);
  }

  @Post("logout")
  @UseGuards(StaffJwtGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const staff = req["staff"] as StaffPrincipal;
    await this.audit.log({ action: StaffAuditAction.LOGOUT, actor: staff.login, staffId: staff.id, req });
    res.clearCookie(STAFF_COOKIE, cookieOptions());
    return { success: true };
  }
}
