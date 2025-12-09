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
exports.LegacyController = void 0;
const common_1 = require("@nestjs/common");
const telegram_service_1 = require("../telegram/telegram.service");
let LegacyController = class LegacyController {
    telegramService;
    constructor(telegramService) {
        this.telegramService = telegramService;
    }
    root() {
        return {
            status: "ok",
            timestamp: new Date().toISOString(),
            service: "anticore-server",
        };
    }
    health() {
        return { status: "ok" };
    }
    version() {
        return {
            version: process.env.APP_VERSION ||
                process.env.npm_package_version ||
                "unknown",
        };
    }
    async handleFormAction(body) {
        const name = (body.name || "Без имени").toString();
        const phone = (body.phone || "Не указан").toString();
        const message = body.message ? body.message.toString() : "";
        const href = body.href ? body.href.toString() : undefined;
        const communicationMethod = body.contactMethod
            ? body.contactMethod.toString()
            : undefined;
        const carDescription = body.isNotAuto
            ? body.customBrand?.toString()
            : [body.brand, body.model].filter(Boolean).join(" ").trim() || undefined;
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
    loginStub() {
        return {
            success: false,
            message: "Аутентификация не настроена на этом сервисе",
        };
    }
};
exports.LegacyController = LegacyController;
__decorate([
    (0, common_1.All)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegacyController.prototype, "root", null);
__decorate([
    (0, common_1.All)("health"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegacyController.prototype, "health", null);
__decorate([
    (0, common_1.All)("version"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegacyController.prototype, "version", null);
__decorate([
    (0, common_1.Post)("formaction"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LegacyController.prototype, "handleFormAction", null);
__decorate([
    (0, common_1.Post)("login"),
    (0, common_1.HttpCode)(common_1.HttpStatus.NOT_IMPLEMENTED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegacyController.prototype, "loginStub", null);
exports.LegacyController = LegacyController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [telegram_service_1.TelegramService])
], LegacyController);
//# sourceMappingURL=legacy.controller.js.map