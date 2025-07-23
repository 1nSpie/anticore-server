import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';

interface SimpleTelegramMessage {
  name: string;
  phone: string;
  message: string;
  href: string;
}

export type ContactMethod = 'telegram' | 'whatsapp' | 'phone';

export type AutoPriceFormData = {
  brand: string;
  model: string;
  customBrand: string;
  isNotAuto: boolean;
  name: string;
  phone: string;
  contactMethod: ContactMethod;
};

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('send-message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() data: SimpleTelegramMessage) {
    try {
      await this.telegramService.sendMessage(data);
      return { success: true, message: 'Message sent successfully' };
    } catch (error) {
      throw new BadRequestException('Failed to send message: ' + error.message);
    }
  }

  @Post('send-full')
  @HttpCode(HttpStatus.OK)
  async sendFeedback(@Body() data: AutoPriceFormData) {
    try {
      await this.telegramService.sendMessage({
        name: data.name,
        phone: data.phone,
        carDescription: data.isNotAuto
          ? `${data.customBrand}`
          : `${data.brand} ${data.model}`,
        communicationMethod: data.contactMethod,
      });
      return {
        success: true,
        message: 'Feedback sent to Telegram successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to send feedback: ' + error.message,
      );
    }
  }
}
