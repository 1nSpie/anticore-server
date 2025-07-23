interface TelegramMessageData {
    name: string;
    phone: string;
    href?: string;
    message?: string;
    carDescription?: string;
    communicationMethod?: string;
}
export declare class TelegramService {
    private readonly logger;
    private readonly botToken;
    private readonly chatId;
    private readonly apiUrl;
    sendMessage(data: TelegramMessageData): Promise<any>;
    private formatMessage;
    private translateCommunicationMethod;
}
export {};
