import {
  Body,
  Controller,
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
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import {
  CreateStaffDto,
  ResetStaffPasswordDto,
  StaffAuditQueryDto,
  UpdateStaffDto,
} from "./dto/staff.dto";
import { StaffAdminService } from "./staff-admin.service";
import { AdminThrottle } from "../common/throttle";

@Controller("crm/staff")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StaffAdminController {
  constructor(private readonly staff: StaffAdminService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  /** Журнал входов и действий (фильтры: staffId, action). */
  @Get("audit-log")
  auditLog(@Query() query: StaffAuditQueryDto) {
    return this.staff.auditLog(query);
  }

  @Post()
  create(@Body() dto: CreateStaffDto, @Req() req: Request) {
    return this.staff.create(dto, req);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateStaffDto, @Req() req: Request) {
    return this.staff.update(id, dto, req);
  }

  @Post(":id/block")
  block(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    return this.staff.setBlocked(id, true, req);
  }

  @Post(":id/unblock")
  unblock(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    return this.staff.setBlocked(id, false, req);
  }

  @Post(":id/reset-password")
  resetPassword(@Param("id", ParseIntPipe) id: number, @Body() dto: ResetStaffPasswordDto, @Req() req: Request) {
    return this.staff.resetPassword(id, dto, req);
  }
}
