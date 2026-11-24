import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Request, Response } from "express";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { AdminThrottle } from "../../common/throttle";
import { CrmCashService } from "./crm-cash.service";
import { CashQueryDto, CreateCashEntryDto, VoidCashEntryDto } from "./dto/cash.dto";

@Controller("crm/cash")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmCashController {
  constructor(private readonly cash: CrmCashService) {}

  /** Операции за период, остаток на начало и конец, итоги прихода и расхода. */
  @Get()
  list(@Query() q: CashQueryDto) {
    return this.cash.list(q);
  }

  /** Выгрузка в CSV (открывается в Excel). */
  @Get("export")
  async export(@Query() q: CashQueryDto, @Res() res: Response) {
    const csv = await this.cash.csv(q);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="cash-${q.from}_${q.to}.csv"`);
    res.send(csv);
  }

  @Post()
  create(@Body() dto: CreateCashEntryDto, @Req() req: Request) {
    return this.cash.create(dto, req);
  }

  @Post(":id/void")
  voidEntry(@Param("id", ParseIntPipe) id: number, @Body() dto: VoidCashEntryDto, @Req() req: Request) {
    return this.cash.voidEntry(id, dto.reason, req);
  }
}
