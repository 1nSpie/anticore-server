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
exports.BrandsController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BrandsController = class BrandsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllCarWithBrand(id) {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
            throw new Error('ID бренда должен быть числом');
        }
        const cars = await this.prisma.car.findMany({
            where: {
                brandId: numericId,
            },
        });
        const segments = [...new Set(cars.map((car) => car.segment))];
        const priceRecords = await this.prisma.bodyTypePrice.findMany({
            where: {
                segment: {
                    in: segments,
                },
            },
        });
        const carsWithPrices = cars.map((car) => {
            const priceInfo = priceRecords?.find((p) => p.segment === car.segment);
            return {
                ...car,
                prices: priceInfo || null,
            };
        });
        return carsWithPrices;
    }
};
exports.BrandsController = BrandsController;
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "findAllCarWithBrand", null);
exports.BrandsController = BrandsController = __decorate([
    (0, common_1.Controller)('brands'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BrandsController);
//# sourceMappingURL=brands.controller.js.map