import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";
import { Request } from "express";
import { PushService } from "../push/push.service";
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

class PushSubscribeDto {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2000)
  endpoint!: string;

  @IsString()
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @MaxLength(100)
  auth!: string;
}

class PushUnsubscribeDto {
  @IsString()
  @MaxLength(2000)
  endpoint!: string;
}

/** Лента уведомлений мастера. Доступна и до ознакомления с регламентом — именно через неё приходит «регламент изменён». */
@Controller("staff/notifications")
@StaffThrottle()
@UseGuards(StaffJwtGuard)
@Roles("MASTER")
@AllowWithoutRegulationAck()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StaffNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly pushes: PushService,
  ) {}

  @Get()
  list(@Req() req: Request, @Query() q: ListQuery) {
    return this.notifications.list((req["staff"] as StaffPrincipal).id, q.limit);
  }

  /** Публичный VAPID-ключ для подписки устройства; `null` — push на сервере не настроен. */
  @Get("push/key")
  pushKey() {
    return { publicKey: this.pushes.publicKey };
  }

  @Post("push/subscribe")
  @HttpCode(200)
  pushSubscribe(@Req() req: Request, @Body() dto: PushSubscribeDto) {
    return this.pushes.subscribe(`staff:${(req["staff"] as StaffPrincipal).id}`, dto);
  }

  @Delete("push/subscribe")
  pushUnsubscribe(@Req() req: Request, @Body() dto: PushUnsubscribeDto) {
    return this.pushes.unsubscribe(`staff:${(req["staff"] as StaffPrincipal).id}`, dto.endpoint);
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
