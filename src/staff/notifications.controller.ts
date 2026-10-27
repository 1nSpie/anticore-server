import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Request } from "express";
import { NotificationsService } from "./notifications.service";
import { AllowWithoutRegulationAck } from "./regulation-ack.decorator";
import { Roles } from "./roles.decorator";
import { StaffJwtGuard, StaffPrincipal } from "./staff-jwt.guard";
import { StaffThrottle } from "../common/throttle";

class ListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** Лента уведомлений мастера. Доступна и до ознакомления с регламентом — именно через неё приходит «регламент изменён». */
@Controller("staff/notifications")
@StaffThrottle()
@UseGuards(StaffJwtGuard)
@Roles("MASTER")
@AllowWithoutRegulationAck()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StaffNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: Request, @Query() q: ListQuery) {
    return this.notifications.list((req["staff"] as StaffPrincipal).id, q.limit);
  }

  @Post("read-all")
  @HttpCode(200)
  readAll(@Req() req: Request) {
    return this.notifications.markAllRead((req["staff"] as StaffPrincipal).id);
  }

  @Post(":id/read")
  @HttpCode(200)
  read(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    return this.notifications.markRead((req["staff"] as StaffPrincipal).id, id);
  }
}
