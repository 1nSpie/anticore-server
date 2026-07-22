import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { TelegramService } from "./telegram.service";
import {
  SiteCallbackDto,
  SitePriceRequestDto,
} from "../common/dto/site-form.dto";
import { normalizePhoneRu } from "../cabinet/common/phone.util";

@Controller("telegram")
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post("send-message")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendMessage(@Body() data: SiteCallbackDto) {
    const payload = {
      name: data.name.trim(),
      phone: normalizePhoneRu(data.phone),
      message: data.message?.trim() || "",
      href: data.href?.trim() || "",
    };
    await this.telegramService.sendMessage(payload);
    return { success: true, message: "Message sent successfully" };
  }

  @Post("send-full")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendFeedback(@Body() data: SitePriceRequestDto) {
    const carDescription =
      data.carDescription?.trim() ||
      (data.isNotAuto
        ? data.customBrand?.trim()
        : [data.brand, data.model].filter(Boolean).join(" ").trim()) ||
      undefined;

    const payload = {
      name: data.name.trim(),
      phone: normalizePhoneRu(data.phone),
      carDescription,
      communicationMethod: data.contactMethod ?? data.communicationMethod,
      href: data.href?.trim() || "",
    };

    await this.telegramService.sendMessage(payload);
    return {
      success: true,
      message: "Feedback sent to Telegram successfully",
    };
  }
}
