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
exports.WorksController = void 0;
const common_1 = require("@nestjs/common");
const works_service_1 = require("./works.service");
const work_dto_1 = require("./dto/work.dto");
let WorksController = class WorksController {
    worksService;
    constructor(worksService) {
        this.worksService = worksService;
    }
    createWork(createWorkDto) {
        return this.worksService.createWork(createWorkDto);
    }
    findAllWorks(categoryId, featured, published) {
        return this.worksService.findAllWorks(categoryId ? parseInt(categoryId) : undefined, featured ? featured === 'true' : undefined, published ? published === 'true' : true);
    }
    getWorksStats() {
        return this.worksService.getWorksStats();
    }
    findWorkBySlug(slug) {
        return this.worksService.findWorkBySlug(slug);
    }
    findWorkById(id) {
        return this.worksService.findWorkById(id);
    }
    updateWork(id, updateWorkDto) {
        return this.worksService.updateWork(id, updateWorkDto);
    }
    deleteWork(id) {
        return this.worksService.deleteWork(id);
    }
    createWorkCategory(createCategoryDto) {
        return this.worksService.createWorkCategory(createCategoryDto);
    }
    findAllWorkCategories() {
        return this.worksService.findAllWorkCategories();
    }
    findWorkCategoryById(id) {
        return this.worksService.findWorkCategoryById(id);
    }
    updateWorkCategory(id, updateCategoryDto) {
        return this.worksService.updateWorkCategory(id, updateCategoryDto);
    }
    deleteWorkCategory(id) {
        return this.worksService.deleteWorkCategory(id);
    }
};
exports.WorksController = WorksController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [work_dto_1.CreateWorkDto]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "createWork", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('featured')),
    __param(2, (0, common_1.Query)('published')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "findAllWorks", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "getWorksStats", null);
__decorate([
    (0, common_1.Get)('slug/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "findWorkBySlug", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "findWorkById", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, work_dto_1.UpdateWorkDto]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "updateWork", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "deleteWork", null);
__decorate([
    (0, common_1.Post)('categories'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [work_dto_1.CreateWorkCategoryDto]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "createWorkCategory", null);
__decorate([
    (0, common_1.Get)('categories/all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "findAllWorkCategories", null);
__decorate([
    (0, common_1.Get)('categories/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "findWorkCategoryById", null);
__decorate([
    (0, common_1.Put)('categories/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, work_dto_1.UpdateWorkCategoryDto]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "updateWorkCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WorksController.prototype, "deleteWorkCategory", null);
exports.WorksController = WorksController = __decorate([
    (0, common_1.Controller)('works'),
    __metadata("design:paramtypes", [works_service_1.WorksService])
], WorksController);
//# sourceMappingURL=works.controller.js.map