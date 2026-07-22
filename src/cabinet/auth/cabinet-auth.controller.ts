import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request, Response } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { clientIpFromRequest } from "../common/client-ip.util";
import { CabinetAuthService } from "./cabinet-auth.service";
import { RegisterDto } from "./dto/register.dto";
import { VerifyRegistrationDto } from "./dto/verify-registration.dto";
import { CabinetLoginDto } from "./dto/cabinet-login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

/**
 * Аутентификация клиентов личного кабинета (не путать с /admin/login).
 * Refresh-токен — в httpOnly-куке; access — в теле ответа.
 */
@SkipThrottle()
@Controller("auth")
export class CabinetAuthController {
  constructor(private readonly cabinetAuth: CabinetAuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  register(@Req() req: Request, @Body() dto: RegisterDto) {
    return this.cabinetAuth.register(dto, clientIpFromRequest(req));
  }

  @Post("verify-registration")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  verifyRegistration(
    @Body() dto: VerifyRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cabinetAuth.verifyRegistration(dto, res);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  login(
    @Body() dto: CabinetLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cabinetAuth.login(dto, res);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const name = this.cabinetAuth.getRefreshCookieName();
    return this.cabinetAuth.refresh(req.cookies?.[name], res);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const name = this.cabinetAuth.getRefreshCookieName();
    return this.cabinetAuth.logout(req.cookies?.[name], res);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  forgotPassword(@Req() req: Request, @Body() dto: ForgotPasswordDto) {
    return this.cabinetAuth.forgotPassword(dto, clientIpFromRequest(req));
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.cabinetAuth.resetPassword(dto);
  }
}
