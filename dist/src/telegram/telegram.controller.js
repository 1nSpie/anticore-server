"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramController = void 0;
const common_1 = require("@nestjs/common");
const telegram_service_1 = require("./telegram.service");
let TelegramController = class TelegramController {
    telegramService;
    constructor(telegramService) {
        this.telegramService = telegramService;
    }
    async sendMessage(data) {
        try {
            await this.telegramService.sendMessage(data);
            return { success: true, message: 'Message sent successfully' };
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to send message: ' + error.message);
        }
    }
    async sendFeedback(data) {
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
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to send feedback: ' + error.message);
        }
    }
};
exports.TelegramController = TelegramController;
__decorate([
    (0, common_1.Post)('send-message'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TelegramController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('send-full'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TelegramController.prototype, "sendFeedback", null);
exports.TelegramController = TelegramController = __decorate([
    (0, common_1.Controller)('telegram'),
    __metadata("design:paramtypes", [telegram_service_1.TelegramService])
], TelegramController);
//# sourceMappingURL=telegram.controller.js.map