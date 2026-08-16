import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { CabinetJwtGuard } from "../auth/cabinet-jwt.guard";
import { CabinetAuthService } from "../auth/cabinet-auth.service";
import { ClientVehiclesService } from "../../client-vehicles/client-vehicles.service";
import { UpsertClientVehicleDto } from "../../client-vehicles/dto/upsert-client-vehicle.dto";
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
    private readonly vehicles: ClientVehiclesService,
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

  @Get("vehicles")
  listVehicles(@Req() req: Request) {
    return this.vehicles.listForUser(req.cabinetUserId!);
  }

  @Post("vehicles")
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createVehicle(@Req() req: Request, @Body() dto: UpsertClientVehicleDto) {
    return this.vehicles.create(req.cabinetUserId!, dto);
  }

  @Patch("vehicles/:id")
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateVehicle(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpsertClientVehicleDto,
  ) {
    return this.vehicles.update(req.cabinetUserId!, id, dto);
  }

  @Delete("vehicles/:id")
  archiveVehicle(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.vehicles.archive(req.cabinetUserId!, id);
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
  visits(
    @Req() req: Request,
    @Query("vehicleId") vehicleIdRaw?: string,
  ) {
    const vehicleId =
      vehicleIdRaw && /^\d+$/.test(vehicleIdRaw)
        ? Number(vehicleIdRaw)
        : undefined;
    return this.cabinetUser.listVisits(req.cabinetUserId!, vehicleId);
  }

  @Get("leads")
  leads(@Req() req: Request) {
    return this.cabinetUser.listLeads(req.cabinetUserId!);
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
