import { Injectable, Logger } from '@nestjs/common';
import { VK } from 'vk-io';

interface VkMessageData {
    name: string;
    phone: string;
    href?: string;
    message?: string;
    carDescription?: string;
    communicationMethod?: string;
}

@Injectable()
export class VkService {
    private readonly logger = new Logger(VkService.name);
    private readonly vk: VK;
    private readonly chatPeerId: number;

    constructor() {
        console.log('=== VK Config Debug ===');
        console.log('VK_ACCESS_TOKEN exists:', !!process.env.VK_ACCESS_TOKEN);
        console.log('VK_ACCESS_TOKEN value:', process.env.VK_ACCESS_TOKEN?.substring(0, 10) + '...');
        console.log('VK_CHAT_PEER_ID exists:', !!process.env.VK_CHAT_PEER_ID);
        console.log('VK_CHAT_PEER_ID value:', process.env.VK_CHAT_PEER_ID);
        console.log('=======================');

        const token = process.env.VK_ACCESS_TOKEN;
        const chatPeerId = process.env.VK_CHAT_PEER_ID;

        if (!token || !chatPeerId) {
            this.logger.warn('VK configuration missing');
            return;
        }

        this.vk = new VK({ token });
        this.chatPeerId = parseInt(chatPeerId, 10);


        if (!token || !chatPeerId) {
            this.logger.warn('VK configuration missing');
            return;
        }

        this.vk = new VK({ token });
        this.chatPeerId = parseInt(chatPeerId, 10); // peer_id беседы
    }

    async sendMessage(data: VkMessageData) {
        if (!this.vk || !this.chatPeerId) {
            this.logger.error('VK bot not configured');
            throw new Error('VK configuration missing');
        }

        if (!data.name || !data.phone) {
            this.logger.error('Missing required fields: name or phone');
            throw new Error('Name and phone are required');
        }

        const text = this.formatMessage(data);

        try {
            // Отправка в беседу
            const result = await this.vk.api.messages.send({
                peer_id: this.chatPeerId,  // ID беседы
                message: text,
                random_id: Date.now(),     // уникальный ID для предотвращения дубликатов
            });

            this.logger.log(`VK message sent to chat, message_id: ${result}`);
            return { success: true, messageId: result };
        } catch (error) {
            this.logger.error('Failed to send VK message:', error.message);
            throw new Error(`Failed to send VK notification: ${error.message}`);
        }
    }

    private formatMessage(data: VkMessageData): string {
        const { name, phone, message, carDescription, communicationMethod, href } = data;

        let formattedMessage = '🔔 НОВАЯ ЗАЯВКА С САЙТА!\n\n';
        formattedMessage += `👤 Имя: ${name}\n`;
        formattedMessage += `📞 Телефон: ${phone}\n`;

        if (href) {
            formattedMessage += `🔗 Страница: ${href}\n`;
        }

        if (communicationMethod) {
            formattedMessage += `💬 Связь: ${this.translateMethod(communicationMethod)}\n`;
        }

        if (carDescription) {
            formattedMessage += `🚗 Авто: ${carDescription}\n`;
        }

        if (message) {
            formattedMessage += `📝 Сообщение: ${message}\n`;
        }

        formattedMessage += `\n🕒 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

        return formattedMessage;
    }

    private translateMethod(method: string): string {
        const translations: Record<string, string> = {
            phone: '📞 Телефон',
            whatsapp: '📱 WhatsApp',
            telegram: '💬 Telegram',
            email: '📧 Email',
        };
        return translations[method] || method;
    }
}