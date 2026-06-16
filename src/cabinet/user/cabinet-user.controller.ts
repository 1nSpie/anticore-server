import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { CabinetJwtGuard } from "../auth/cabinet-jwt.guard";
import { CabinetAuthService } from "../auth/cabinet-auth.service";
import { CabinetUserService } from "./cabinet-user.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateNotificationsDto } from "./dto/update-notifications.dto";

/**
 * Профиль и данные клиента личного кабинета.
 */
@Controller("user")
@UseGuards(CabinetJwtGuard)
export class CabinetUserController {
  constructor(
    private readonly cabinetUser: CabinetUserService,
    private readonly cabinetAuth: CabinetAuthService,
  ) {}

  @Get("profile")
  getProfile(@Req() req: Request) {
    return this.cabinetUser.getProfile(req.cabinetUserId!);
  }

  @Put("profile")
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return this.cabinetUser.updateProfile(req.cabinetUserId!, dto);
  }

  @Post("profile/change-password")
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ) {
    const name = this.cabinetAuth.getRefreshCookieName();
    return this.cabinetUser.changePassword(
      req.cabinetUserId!,
      dto,
      req.cookies?.[name],
    );
  }

  @Get("history/visits")
  visits(@Req() req: Request) {
    return this.cabinetUser.listVisits(req.cabinetUserId!);
  }

  @Get("payments")
  payments(@Req() req: Request) {
    return this.cabinetUser.listPayments(req.cabinetUserId!);
  }

  @Get("notifications")
  notifications(@Req() req: Request) {
    return this.cabinetUser.getNotificationSettings(req.cabinetUserId!);
  }

  @Put("notifications")
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateNotifications(
    @Req() req: Request,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.cabinetUser.updateNotificationSettings(
      req.cabinetUserId!,
      dto,
    );
  }
}
