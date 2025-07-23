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
exports.StaticController = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs_1 = require("fs");
let StaticController = class StaticController {
    publicPath = (0, path_1.join)(process.cwd(), 'public');
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
                url: `/static/${folder}/${file}`,
                fullUrl: `${process.env.BACKEND_BASE_URL || 'http://localhost:4444'}/static/${folder}/${file}`,
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
    serveImage(folder, filename, res) {
        const filePath = (0, path_1.join)(this.publicPath, folder, filename);
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new common_1.NotFoundException(`Image ${folder}/${filename} not found`);
        }
        return res.sendFile(filePath);
    }
};
exports.StaticController = StaticController;
__decorate([
    (0, common_1.Get)('images/:folder'),
    __param(0, (0, common_1.Param)('folder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StaticController.prototype, "getImagesList", null);
__decorate([
    (0, common_1.Get)('images/:folder/:filename'),
    __param(0, (0, common_1.Param)('folder')),
    __param(1, (0, common_1.Param)('filename')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], StaticController.prototype, "serveImage", null);
exports.StaticController = StaticController = __decorate([
    (0, common_1.Controller)('static')
], StaticController);
//# sourceMappingURL=static.controller.js.map