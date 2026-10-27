import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { CheckinService } from "./checkin.service";
import { CheckinDto, CheckinListQueryDto, DecideCheckinDto } from "./dto/checkin.dto";
import { Roles } from "./roles.decorator";
import { StaffJwtGuard, StaffPrincipal } from "./staff-jwt.guard";
import { AdminThrottle, StaffThrottle } from "../common/throttle";

const pipe = new ValidationPipe({ transform: true, whitelist: true });

/** Чекин мастера: начало смены, один в сутки. */
@Controller("staff/checkin")
@StaffThrottle()
@UseGuards(StaffJwtGuard)
@Roles("MASTER")
@UsePipes(pipe)
export class StaffCheckinController {
  constructor(private readonly checkins: CheckinService) {}

  @Get("today")
  today(@Req() req: Request) {
    return this.checkins.today((req["staff"] as StaffPrincipal).id);
  }

  @Post("consent")
  @HttpCode(200)
  consent(@Req() req: Request) {
    return this.checkins.giveGeoConsent((req["staff"] as StaffPrincipal).id, req);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CheckinDto) {
    return this.checkins.checkin(req["staff"] as StaffPrincipal, dto, req);
  }
}

/** Чекины в админке: просмотр и подтверждение. */
@Controller("crm/checkins")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(pipe)
export class CrmCheckinsController {
  constructor(private readonly checkins: CheckinService) {}

  @Get()
  list(@Query() q: CheckinListQueryDto) {
    return this.checkins.list(q);
  }

  @Post(":id/decision")
  @HttpCode(200)
  decide(@Param("id", ParseIntPipe) id: number, @Body() dto: DecideCheckinDto, @Req() req: Request) {
    return this.checkins.decide(id, dto.status, req);
  }
}
