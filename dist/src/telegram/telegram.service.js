"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TelegramService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let TelegramService = TelegramService_1 = class TelegramService {
    logger = new common_1.Logger(TelegramService_1.name);
    botToken = process.env.TELEGRAM_BOT_TOKEN;
    chatId = process.env.TELEGRAM_CHAT_ID;
    apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    async sendMessage(data) {
        if (!this.botToken || !this.chatId) {
            this.logger.error('Telegram bot token or chat ID not configured');
            throw new Error('Telegram configuration missing');
        }
        const text = this.formatMessage(data);
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/sendMessage`, {
                chat_id: this.chatId,
                text,
                parse_mode: 'HTML',
            });
            this.logger.log('Telegram message sent successfully');
            return response.data;
        }
        catch (error) {
            this.logger.error('Failed to send Telegram message:', error.response?.data || error.message);
            throw new Error('Failed to send notification');
        }
    }
    formatMessage(data) {
        const { name, phone, message, carDescription, communicationMethod, href } = data;
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
    translateCommunicationMethod(method) {
        const translations = {
            phone: '📞 Телефон',
            whatsapp: '📱 WhatsApp',
            telegram: '💬 Telegram',
            email: '📧 Email',
        };
        return translations[method] || method;
    }
};
exports.TelegramService = TelegramService;
exports.TelegramService = TelegramService = TelegramService_1 = __decorate([
    (0, common_1.Injectable)()
], TelegramService);
//# sourceMappingURL=telegram.service.js.map