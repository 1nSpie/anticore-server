import { TelegramService } from "../telegram/telegram.service";
export declare class LegacyController {
    private readonly telegramService;
    constructor(telegramService: TelegramService);
    root(): {
        status: string;
        timestamp: string;
        service: string;
    };
    health(): {
        status: string;
    };
    version(): {
        version: string;
    };
    handleFormAction(body: Record<string, any>): Promise<{
        success: boolean;
    }>;
    loginStub(): {
        success: boolean;
        message: string;
    };
}
