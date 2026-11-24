import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Request } from "express";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { AdminThrottle } from "../common/throttle";
import {
  CreateBonusTypeDto,
  PayrollReportQueryDto,
  SetBonusDto,
  SetReceiverDto,
  UpdateBonusTypeDto,
  UpdatePayrollSettingsDto,
} from "./dto/payroll.dto";
import { PayrollService } from "./payroll.service";

@Controller("crm/payroll")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("settings")
  settings() {
    return this.payroll.getSettings();
  }

  @Put("settings")
  updateSettings(@Body() dto: UpdatePayrollSettingsDto, @Req() req: Request) {
    return this.payroll.updateSettings(dto, req);
  }

  @Get("bonus-types")
  bonusTypes() {
    return this.payroll.listBonusTypes();
  }

  @Post("bonus-types")
  createBonusType(@Body() dto: CreateBonusTypeDto, @Req() req: Request) {
    return this.payroll.createBonusType(dto, req);
  }

  @Patch("bonus-types/:id")
  updateBonusType(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateBonusTypeDto, @Req() req: Request) {
    return this.payroll.updateBonusType(id, dto, req);
  }

  @Get("report")
  report(@Query() q: PayrollReportQueryDto) {
    return this.payroll.report(q);
  }

  /** Зарплата одной записи: начисления, доп. выплаты, условия закрытия. */
  @Get("visits/:id")
  forVisit(@Param("id", ParseIntPipe) id: number) {
    return this.payroll.forVisit(id);
  }

  @Put("visits/:id/receiver")
  setReceiver(@Param("id", ParseIntPipe) id: number, @Body() dto: SetReceiverDto, @Req() req: Request) {
    return this.payroll.setReceiver(id, dto.staffId ?? null, req);
  }

  @Put("entries/:id/bonus")
  setBonus(@Param("id", ParseIntPipe) id: number, @Body() dto: SetBonusDto, @Req() req: Request) {
    return this.payroll.setBonus(id, dto.typeId, dto.granted, req);
  }
}
