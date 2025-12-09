import {
  All,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";

import { TelegramService } from "../telegram/telegram.service";

@Controller()
export class LegacyController {
  constructor(private readonly telegramService: TelegramService) {}

  @All()
  @HttpCode(HttpStatus.OK)
  root() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "anticore-server",
    };
  }

  @All("health")
  @HttpCode(HttpStatus.OK)
  health() {
    return { status: "ok" };
  }

  @All("version")
  @HttpCode(HttpStatus.OK)
  version() {
    return {
      version:
        process.env.APP_VERSION ||
        process.env.npm_package_version ||
        "unknown",
    };
  }

  @Post("formaction")
  async handleFormAction(@Body() body: Record<string, any>) {
    const name = (body.name || "Без имени").toString();
    const phone = (body.phone || "Не указан").toString();
    const message = body.message ? body.message.toString() : "";
    const href = body.href ? body.href.toString() : undefined;

    // Дополнительные поля для описания авто и способа связи
    const communicationMethod = body.contactMethod
      ? body.contactMethod.toString()
      : undefined;
    const carDescription = body.isNotAuto
      ? body.customBrand?.toString()
      : [body.brand, body.model].filter(Boolean).join(" ").trim() || undefined;

    // Отправляем как обычное уведомление в Telegram, чтобы заявки не терялись
    await this.telegramService.sendMessage({
      name,
      phone,
      message,
      href,
      communicationMethod,
      carDescription,
    });

    return { success: true };
  }

  @Post("login")
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  loginStub() {
    // Заглушка, чтобы явно показать отсутствие авторизации и не получать 404
    return {
      success: false,
      message: "Аутентификация не настроена на этом сервисе",
    };
  }
}

