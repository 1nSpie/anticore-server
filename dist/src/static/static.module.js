"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticModule = void 0;
const common_1 = require("@nestjs/common");
const static_controller_1 = require("./static.controller");
const image_optimization_service_1 = require("./image-optimization.service");
let StaticModule = class StaticModule {
};
exports.StaticModule = StaticModule;
exports.StaticModule = StaticModule = __decorate([
    (0, common_1.Module)({
        controllers: [static_controller_1.StaticController],
        providers: [image_optimization_service_1.ImageOptimizationService],
        exports: [image_optimization_service_1.ImageOptimizationService],
    })
], StaticModule);
//# sourceMappingURL=static.module.js.map