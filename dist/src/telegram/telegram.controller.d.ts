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
export declare class TelegramController {
    private readonly telegramService;
    constructor(telegramService: TelegramService);
    sendMessage(data: SimpleTelegramMessage): Promise<{
        success: boolean;
        message: string;
    }>;
    sendFeedback(data: AutoPriceFormData): Promise<{
        success: boolean;
        message: string;
    }>;
}
export {};
