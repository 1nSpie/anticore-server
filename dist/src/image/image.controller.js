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
exports.ImageController = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const image_service_1 = require("./image.service");
let ImageController = class ImageController {
    imageService;
    constructor(imageService) {
        this.imageService = imageService;
    }
    getBlogImage(filename, res) {
        const imagePath = this.imageService.getBlogImagePath(filename);
        console.log('Requested filename:', filename);
        console.log('Resolved path:', imagePath);
        console.log('File exists:', fs.existsSync(imagePath));
        if (!fs.existsSync(imagePath)) {
            return res
                .status(common_1.HttpStatus.NOT_FOUND)
                .json({ error: 'Blog image not found', path: imagePath });
        }
        res.sendFile(imagePath);
    }
    listBlogImages() {
        return {
            images: this.imageService.listBlogImages(),
            total: this.imageService.listBlogImages().length,
        };
    }
    getImage(filename, res) {
        const imagePath = this.imageService.getImagePath('', filename);
        if (!fs.existsSync(imagePath)) {
            return res
                .status(common_1.HttpStatus.NOT_FOUND)
                .json({ error: 'Image not found' });
        }
        res.sendFile(imagePath);
    }
};
exports.ImageController = ImageController;
__decorate([
    (0, common_1.Get)('blog/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ImageController.prototype, "getBlogImage", null);
__decorate([
    (0, common_1.Get)('blog'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ImageController.prototype, "listBlogImages", null);
__decorate([
    (0, common_1.Get)(':filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ImageController.prototype, "getImage", null);
exports.ImageController = ImageController = __decorate([
    (0, common_1.Controller)('image'),
    __metadata("design:paramtypes", [image_service_1.ImageService])
], ImageController);
//# sourceMappingURL=image.controller.js.map