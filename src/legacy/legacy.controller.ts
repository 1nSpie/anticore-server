import {
  All,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { TelegramService } from "../telegram/telegram.service";
import { SitePriceRequestDto } from "../common/dto/site-form.dto";
import { normalizePhoneRu } from "../cabinet/common/phone.util";

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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleFormAction(@Body() body: SitePriceRequestDto) {
    const name = body.name.trim() || "Без имени";
    const phone = normalizePhoneRu(body.phone);
    const message = body.message?.trim() ?? "";
    const href = body.href?.trim() || undefined;

    const communicationMethod = body.contactMethod ?? body.communicationMethod;
    const carDescription =
      body.carDescription?.trim() ||
      (body.isNotAuto
        ? body.customBrand?.trim()
        : [body.brand, body.model].filter(Boolean).join(" ").trim()) ||
      undefined;

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

