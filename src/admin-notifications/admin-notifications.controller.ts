import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";
import { Request } from "express";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { AdminThrottle } from "../common/throttle";
import { AdminNotificationsService } from "./admin-notifications.service";

class ListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

class SubscribeDto {
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

class UnsubscribeDto {
  @IsString()
  @MaxLength(2000)
  endpoint!: string;
}

/** Лента уведомлений администратора и подписка устройства на push. */
@Controller("crm/notifications")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Get()
  list(@Query() q: ListQuery) {
    return this.notifications.list(q.limit);
  }

  /** Публичный VAPID-ключ для `pushManager.subscribe`; `null` — push на сервере не настроен. */
  @Get("push/key")
  key() {
    return { publicKey: this.notifications.publicKey };
  }

  @Post("push/subscribe")
  @HttpCode(200)
  subscribe(@Req() req: Request, @Body() dto: SubscribeDto) {
    const admin = req["admin"] as { id: string };
    return this.notifications.subscribe(admin.id, dto);
  }

  @Delete("push/subscribe")
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.notifications.unsubscribe(dto.endpoint);
  }

  @Post("read-all")
  @HttpCode(200)
  readAll() {
    return this.notifications.markAllRead();
  }

  @Post(":id/read")
  @HttpCode(200)
  read(@Param("id", ParseIntPipe) id: number) {
    return this.notifications.markRead(id);
  }
}
