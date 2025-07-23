"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cars_module_1 = require("./cars/cars.module");
const brands_module_1 = require("./brands/brands.module");
const prisma_module_1 = require("./prisma/prisma.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const segment_module_1 = require("./segment/segment.module");
const blog_module_1 = require("./blog/blog.module");
const works_module_1 = require("./works/works.module");
const video_controller_1 = require("./video/video.controller");
const image_module_1 = require("./image/image.module");
const static_module_1 = require("./static/static.module");
const telegram_module_1 = require("./telegram/telegram.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            cars_module_1.CarsModule,
            brands_module_1.BrandsModule,
            segment_module_1.SegmentModule,
            blog_module_1.BlogModule,
            works_module_1.WorksModule,
            image_module_1.ImageModule,
            static_module_1.StaticModule,
            telegram_module_1.TelegramModule,
        ],
        controllers: [video_controller_1.VideoController],
        providers: [
            {
                provide: core_1.APP_FILTER,
                useClass: http_exception_filter_1.AllExceptionsFilter,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map