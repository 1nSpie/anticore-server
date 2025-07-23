"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
let ImageService = class ImageService {
    publicDir = path.resolve(process.cwd(), 'public');
    getBlogImageUrl(filename) {
        return `/api/image/blog/${filename}`;
    }
    getImageUrl(filename) {
        return `/api/image/${filename}`;
    }
    checkImageExists(category, filename) {
        const imagePath = path.join(this.publicDir, category, filename);
        return fs.existsSync(imagePath);
    }
    checkBlogImageExists(filename) {
        const imagePath = path.join(this.publicDir, 'blog', filename);
        return fs.existsSync(imagePath);
    }
    listBlogImages() {
        const blogDir = path.join(this.publicDir, 'blog');
        if (!fs.existsSync(blogDir)) {
            return [];
        }
        return fs.readdirSync(blogDir).filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
    }
    getImagePath(category, filename) {
        return path.join(this.publicDir, category, filename);
    }
    getBlogImagePath(filename) {
        return path.join(this.publicDir, 'blog', filename);
    }
};
exports.ImageService = ImageService;
exports.ImageService = ImageService = __decorate([
    (0, common_1.Injectable)()
], ImageService);
//# sourceMappingURL=image.service.js.map