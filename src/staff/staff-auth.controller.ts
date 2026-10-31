import {
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
import { StaffThrottle } from "../common/throttle";
import { Request, Response } from "express";
import { StaffAuditAction, StaffAuditService } from "./staff-audit.service";
import { toPublic } from "./staff-auth.service";
import { AllowWithoutRegulationAck } from "./regulation-ack.decorator";
import { STAFF_COOKIE, StaffJwtGuard, StaffPrincipal } from "./staff-jwt.guard";

const cookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    path: "/",
  };
};

/** Сессия мастера: `me` и выход. Вход — единый, `POST /admin/login` (см. `session.controller.ts`). */
@Controller("staff/auth")
@StaffThrottle()
@AllowWithoutRegulationAck()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StaffAuthController {
  constructor(private readonly audit: StaffAuditService) {}

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
