"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyModule = void 0;
const common_1 = require("@nestjs/common");
const legacy_controller_1 = require("./legacy.controller");
const telegram_module_1 = require("../telegram/telegram.module");
let LegacyModule = class LegacyModule {
};
exports.LegacyModule = LegacyModule;
exports.LegacyModule = LegacyModule = __decorate([
    (0, common_1.Module)({
        imports: [telegram_module_1.TelegramModule],
        controllers: [legacy_controller_1.LegacyController],
    })
], LegacyModule);
//# sourceMappingURL=legacy.module.js.map