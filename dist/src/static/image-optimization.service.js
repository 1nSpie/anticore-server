"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ImageOptimizationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageOptimizationService = void 0;
const common_1 = require("@nestjs/common");
const sharp = require("sharp");
const fs_1 = require("fs");
let ImageOptimizationService = ImageOptimizationService_1 = class ImageOptimizationService {
    logger = new common_1.Logger(ImageOptimizationService_1.name);
    imageCache = new Map();
    MAX_CACHE_SIZE = 200;
    MAX_WIDTH = 3840;
    DEFAULT_QUALITY = 85;
    async optimizeImage(filePath, options = {}) {
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new Error(`Image file not found: ${filePath}`);
        }
        const { width: targetWidth, quality: targetQuality = this.DEFAULT_QUALITY, format: targetFormat, } = options;
        const finalFormat = targetFormat || this.getOptimalFormat(filePath);
        const finalQuality = Math.min(Math.max(targetQuality, 1), 100);
        const cacheKey = `${filePath}_w${targetWidth}_q${finalQuality}_${finalFormat}`;
        if (this.imageCache.has(cacheKey)) {
            return {
                buffer: this.imageCache.get(cacheKey),
                format: finalFormat,
                fromCache: true,
            };
        }
        try {
            if (!targetWidth && !options.quality && !options.format) {
                if (this.getFileExtension(filePath) === "svg") {
                    const fs = await Promise.resolve().then(() => require("fs/promises"));
                    const buffer = await fs.readFile(filePath);
                    return {
                        buffer,
                        format: "svg",
                        fromCache: false,
                    };
                }
            }
            let sharpInstance = sharp(filePath);
            const metadata = await sharpInstance.metadata();
            if (targetWidth && targetWidth > 0 && targetWidth <= this.MAX_WIDTH) {
                const resizeWidth = Math.min(targetWidth, metadata.width || targetWidth);
                sharpInstance = sharpInstance.resize(resizeWidth, null, {
                    withoutEnlargement: true,
                    fit: "inside",
                });
            }
            switch (finalFormat.toLowerCase()) {
                case "webp":
                    sharpInstance = sharpInstance.webp({
                        quality: finalQuality,
                        effort: 4,
                    });
                    break;
                case "avif":
                    sharpInstance = sharpInstance.avif({
                        quality: finalQuality,
                        effort: 4,
                    });
                    break;
                case "jpeg":
                case "jpg":
                    sharpInstance = sharpInstance.jpeg({
                        quality: finalQuality,
                        progressive: true,
                        mozjpeg: true,
                    });
                    break;
                case "png":
                    sharpInstance = sharpInstance.png({
                        quality: finalQuality,
                        progressive: true,
                        compressionLevel: 9,
                    });
                    break;
                default:
                    if (metadata.format === "jpeg") {
                        sharpInstance = sharpInstance.jpeg({
                            quality: finalQuality,
                            progressive: true,
                        });
                    }
                    else if (metadata.format === "png") {
                        sharpInstance = sharpInstance.png({
                            quality: finalQuality,
                            progressive: true,
                        });
                    }
                    break;
            }
            const optimizedBuffer = await sharpInstance.toBuffer();
            this.cacheImage(cacheKey, optimizedBuffer);
            this.logger.log(`Optimized image: ${filePath} (${metadata.width}x${metadata.height}) -> ${finalFormat} q${finalQuality}`);
            return {
                buffer: optimizedBuffer,
                format: finalFormat,
                fromCache: false,
            };
        }
        catch (error) {
            this.logger.error(`Error optimizing image ${filePath}:`, error.message);
            throw error;
        }
    }
    cacheImage(key, buffer) {
        if (this.imageCache.size >= this.MAX_CACHE_SIZE) {
            const keysToRemove = Array.from(this.imageCache.keys()).slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.1));
            keysToRemove.forEach((key) => this.imageCache.delete(key));
        }
        this.imageCache.set(key, buffer);
    }
    getMimeType(format) {
        const mimeTypes = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            avif: "image/avif",
            gif: "image/gif",
            svg: "image/svg+xml",
        };
        return mimeTypes[format.toLowerCase()] || "image/jpeg";
    }
    getFileExtension(filePath) {
        return filePath.split(".").pop()?.toLowerCase() || "jpg";
    }
    getOptimalFormat(filePath) {
        const extension = this.getFileExtension(filePath);
        switch (extension) {
            case "svg":
                return "svg";
            case "gif":
                return "gif";
            case "png":
                return "webp";
            case "jpg":
            case "jpeg":
                return "webp";
            default:
                return "webp";
        }
    }
    getCacheStats() {
        return {
            cacheSize: this.imageCache.size,
            maxCacheSize: this.MAX_CACHE_SIZE,
            cacheKeys: Array.from(this.imageCache.keys()),
        };
    }
    clearCache() {
        this.imageCache.clear();
        this.logger.log("Image cache cleared");
    }
};
exports.ImageOptimizationService = ImageOptimizationService;
exports.ImageOptimizationService = ImageOptimizationService = ImageOptimizationService_1 = __decorate([
    (0, common_1.Injectable)()
], ImageOptimizationService);
//# sourceMappingURL=image-optimization.service.js.map