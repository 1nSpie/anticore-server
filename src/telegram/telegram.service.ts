import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface TelegramMessageData {
  name: string;
  phone: string;
  href?: string;
  message?: string;
  carDescription?: string;
  communicationMethod?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID;
  private readonly apiUrl = `https://api.telegram.org/bot${this.botToken}`;

  async sendMessage(data: TelegramMessageData) {
    if (!this.botToken || !this.chatId) {
      this.logger.error('Telegram bot token or chat ID not configured');
      throw new Error('Telegram configuration missing');
    }

    const text = this.formatMessage(data);

    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
      });

      this.logger.log('Telegram message sent successfully');
      return response.data;
    } catch (error) {
      this.logger.error(
        'Failed to send Telegram message:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to send notification');
    }
  }

  private formatMessage(data: TelegramMessageData): string {
    const { name, phone, message, carDescription, communicationMethod, href } =
      data;

    let formattedMessage = `
🔔 <b>Новая заявка с сайта ANTICORE!</b>

`;
    formattedMessage += `👤 <b>Имя:</b> ${name}\n`;
    formattedMessage += `📞 <b>Телефон:</b> ${phone}\n`;

    if (href) {
      formattedMessage += `📧 <b>Страница:</b> ${href}\n`;
    }
    if (communicationMethod) {
      formattedMessage += `💬 <b>Способ связи:</b> ${this.translateCommunicationMethod(communicationMethod)}\n`;
    }

    if (carDescription) {
      formattedMessage += `🚗 <b>Описание автомобиля:</b> ${carDescription}\n`;
    }

    if (message) {
      formattedMessage += `💬 <b>Сообщение:</b> ${message}\n\n`;
    }
    formattedMessage += `🕒 <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return formattedMessage;
  }

  private translateCommunicationMethod(method: string): string {
    const translations: Record<string, string> = {
      phone: '📞 Телефон',
      whatsapp: '📱 WhatsApp',
      telegram: '💬 Telegram',
      email: '📧 Email',
    };
    return translations[method] || method;
  }
}
