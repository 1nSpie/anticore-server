import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { CabinetAdminService } from "./cabinet-admin.service";
import { BlockUserDto } from "./dto/block-user.dto";
import { CreateVisitDto } from "./dto/create-visit.dto";
import { UpdateVisitDto } from "./dto/update-visit.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import { BroadcastSmsDto } from "./dto/broadcast-sms.dto";

function adminSubject(req: Request): string {
  const admin = (req as Request & { admin?: { id: string } }).admin;
  return String(admin?.id ?? "admin");
}

/**
 * Управление клиентами личного кабинета (только администратор сайта).
 * В карточке клиента — только визиты (история обслуживания).
 */
@Controller("admin/users")
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CabinetAdminController {
  constructor(private readonly cabinetAdmin: CabinetAdminService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.cabinetAdmin.listUsers(
      adminSubject(req),
      q,
      page ? parseInt(page, 10) || 1 : 1,
      limit ? parseInt(limit, 10) || 20 : 20,
    );
  }

  @Post("broadcast")
  broadcast(@Req() req: Request, @Body() dto: BroadcastSmsDto) {
    return this.cabinetAdmin.broadcastSms(adminSubject(req), dto);
  }

  @Get(":id")
  getOne(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    return this.cabinetAdmin.getUser(adminSubject(req), id);
  }

  @Patch(":id")
  updateUser(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.cabinetAdmin.updateUser(adminSubject(req), id, dto);
  }

  @Patch(":id/block")
  block(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: BlockUserDto,
  ) {
    return this.cabinetAdmin.setBlocked(adminSubject(req), id, dto.blocked);
  }

  @Get(":id/visits")
  listVisits(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    return this.cabinetAdmin.listVisits(adminSubject(req), id);
  }

  @Post(":id/visits")
  createVisit(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateVisitDto,
  ) {
    return this.cabinetAdmin.createVisit(adminSubject(req), id, dto);
  }

  @Patch(":id/visits/:visitId")
  updateVisit(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Param("visitId", ParseIntPipe) visitId: number,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.cabinetAdmin.updateVisit(
      adminSubject(req),
      id,
      visitId,
      dto,
    );
  }

  @Delete(":id/visits/:visitId")
  deleteVisit(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Param("visitId", ParseIntPipe) visitId: number,
  ) {
    return this.cabinetAdmin.deleteVisit(adminSubject(req), id, visitId);
  }

  /** Только при `NODE_ENV=development`. */
  @Delete(":id")
  deleteUser(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    return this.cabinetAdmin.deleteUser(adminSubject(req), id);
  }
}
