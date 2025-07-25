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
var StaticController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticController = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs_1 = require("fs");
const image_optimization_service_1 = require("./image-optimization.service");
let StaticController = StaticController_1 = class StaticController {
    imageOptimizationService;
    logger = new common_1.Logger(StaticController_1.name);
    publicPath = (0, path_1.join)(process.cwd(), "public");
    constructor(imageOptimizationService) {
        this.imageOptimizationService = imageOptimizationService;
    }
    getImagesList(folder) {
        const folderPath = (0, path_1.join)(this.publicPath, folder);
        if (!(0, fs_1.existsSync)(folderPath)) {
            throw new common_1.NotFoundException(`Folder ${folder} not found`);
        }
        try {
            const files = (0, fs_1.readdirSync)(folderPath)
                .filter((file) => {
                const filePath = (0, path_1.join)(folderPath, file);
                return ((0, fs_1.statSync)(filePath).isFile() &&
                    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file));
            })
                .map((file) => ({
                name: file,
                url: `/static/images/${folder}/${file}`,
                fullUrl: `${process.env.BACKEND_BASE_URL || "http://localhost:4444"}/static/images/${folder}/${file}`,
            }));
            return {
                folder,
                count: files.length,
                images: files,
            };
        }
        catch (error) {
            throw new common_1.NotFoundException(`Error reading folder ${folder}`);
        }
    }
    async serveImage(folder, filename, res, width, quality, format) {
        const filePath = (0, path_1.join)(this.publicPath, folder, filename);
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new common_1.NotFoundException(`Image ${folder}/${filename} not found`);
        }
        try {
            const targetWidth = width ? parseInt(width, 10) : undefined;
            const targetQuality = quality ? parseInt(quality, 10) : undefined;
            const result = await this.imageOptimizationService.optimizeImage(filePath, {
                width: targetWidth,
                quality: targetQuality,
                format: format,
            });
            this.setImageHeaders(res, result.format, result.fromCache);
            return res.send(result.buffer);
        }
        catch (error) {
            this.logger.error(`Error processing image ${folder}/${filename}:`, error.message);
            try {
                const fileExtension = this.getFileExtension(filename);
                this.setImageHeaders(res, fileExtension, false);
                return res.sendFile(filePath);
            }
            catch (fallbackError) {
                throw new common_1.NotFoundException(`Unable to serve image ${folder}/${filename}`);
            }
        }
    }
    getCacheStats() {
        return this.imageOptimizationService.getCacheStats();
    }
    clearCache() {
        this.imageOptimizationService.clearCache();
        return { message: "Image cache cleared successfully" };
    }
    setImageHeaders(res, format, fromCache = false) {
        const mimeType = this.imageOptimizationService.getMimeType(format);
        res.set({
            "Content-Type": mimeType,
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: `"${Date.now()}"`,
            Vary: "Accept",
            "X-Image-Cache": fromCache ? "HIT" : "MISS",
        });
    }
    getFileExtension(filename) {
        return filename.split(".").pop()?.toLowerCase() || "jpg";
    }
};
exports.StaticController = StaticController;
__decorate([
    (0, common_1.Get)("images/:folder"),
    __param(0, (0, common_1.Param)("folder")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StaticController.prototype, "getImagesList", null);
__decorate([
    (0, common_1.Get)("images/:folder/:filename"),
    __param(0, (0, common_1.Param)("folder")),
    __param(1, (0, common_1.Param)("filename")),
    __param(2, (0, common_1.Res)()),
    __param(3, (0, common_1.Query)("w")),
    __param(4, (0, common_1.Query)("q")),
    __param(5, (0, common_1.Query)("fm")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], StaticController.prototype, "serveImage", null);
__decorate([
    (0, common_1.Get)("cache/stats"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaticController.prototype, "getCacheStats", null);
__decorate([
    (0, common_1.Get)("cache/clear"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaticController.prototype, "clearCache", null);
exports.StaticController = StaticController = StaticController_1 = __decorate([
    (0, common_1.Controller)("static"),
    __metadata("design:paramtypes", [image_optimization_service_1.ImageOptimizationService])
], StaticController);
//# sourceMappingURL=static.controller.js.map