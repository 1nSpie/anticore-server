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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let WorksService = class WorksService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createWork(createWorkDto) {
        const { services, images, ...workData } = createWorkDto;
        return await this.prisma.work.create({
            data: {
                ...workData,
                services: services ? {
                    create: services.map(service => ({ name: service }))
                } : undefined,
                images: images ? {
                    create: images.map(image => ({
                        url: image.url,
                        alt: image.alt,
                        order: image.order || 0
                    }))
                } : undefined
            },
            include: {
                category: true,
                services: true,
                images: { orderBy: { order: 'asc' } }
            }
        });
    }
    async findAllWorks(categoryId, featured, published) {
        const where = {};
        if (categoryId)
            where.categoryId = categoryId;
        if (featured !== undefined)
            where.featured = featured;
        if (published !== undefined)
            where.published = published;
        return await this.prisma.work.findMany({
            where,
            include: {
                category: true,
                services: true,
                images: { orderBy: { order: 'asc' } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async findWorkById(id) {
        const work = await this.prisma.work.findUnique({
            where: { id },
            include: {
                category: true,
                services: true,
                images: { orderBy: { order: 'asc' } }
            }
        });
        if (!work) {
            throw new common_1.NotFoundException(`Work with ID ${id} not found`);
        }
        return work;
    }
    async findWorkBySlug(slug) {
        const work = await this.prisma.work.findUnique({
            where: { slug },
            include: {
                category: true,
                services: true,
                images: { orderBy: { order: 'asc' } }
            }
        });
        if (!work) {
            throw new common_1.NotFoundException(`Work with slug ${slug} not found`);
        }
        return work;
    }
    async updateWork(id, updateWorkDto) {
        const { services, images, ...workData } = updateWorkDto;
        const work = await this.prisma.work.update({
            where: { id },
            data: workData,
            include: {
                category: true,
                services: true,
                images: { orderBy: { order: 'asc' } }
            }
        });
        if (services) {
            await this.prisma.workService.deleteMany({
                where: { workId: id }
            });
            await this.prisma.workService.createMany({
                data: services.map(service => ({
                    workId: id,
                    name: service
                }))
            });
        }
        if (images) {
            await this.prisma.workImage.deleteMany({
                where: { workId: id }
            });
            await this.prisma.workImage.createMany({
                data: images.map(image => ({
                    workId: id,
                    url: image.url,
                    alt: image.alt,
                    order: image.order || 0
                }))
            });
        }
        return await this.findWorkById(id);
    }
    async deleteWork(id) {
        await this.findWorkById(id);
        return await this.prisma.work.delete({
            where: { id }
        });
    }
    async createWorkCategory(createCategoryDto) {
        return await this.prisma.workCategory.create({
            data: createCategoryDto
        });
    }
    async findAllWorkCategories() {
        return await this.prisma.workCategory.findMany({
            include: {
                works: {
                    where: { published: true },
                    select: { id: true, title: true }
                }
            },
            orderBy: { name: 'asc' }
        });
    }
    async findWorkCategoryById(id) {
        const category = await this.prisma.workCategory.findUnique({
            where: { id },
            include: {
                works: {
                    where: { published: true },
                    include: {
                        services: true,
                        images: { orderBy: { order: 'asc' } }
                    }
                }
            }
        });
        if (!category) {
            throw new common_1.NotFoundException(`Work category with ID ${id} not found`);
        }
        return category;
    }
    async updateWorkCategory(id, updateCategoryDto) {
        await this.findWorkCategoryById(id);
        return await this.prisma.workCategory.update({
            where: { id },
            data: updateCategoryDto
        });
    }
    async deleteWorkCategory(id) {
        await this.findWorkCategoryById(id);
        return await this.prisma.workCategory.delete({
            where: { id }
        });
    }
    async getWorksStats() {
        const totalWorks = await this.prisma.work.count();
        const publishedWorks = await this.prisma.work.count({
            where: { published: true }
        });
        const featuredWorks = await this.prisma.work.count({
            where: { featured: true, published: true }
        });
        return {
            totalWorks,
            publishedWorks,
            featuredWorks
        };
    }
};
exports.WorksService = WorksService;
exports.WorksService = WorksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorksService);
//# sourceMappingURL=works.service.js.map