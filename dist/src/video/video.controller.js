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
exports.VideoController = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const fs_2 = require("fs");
const path_1 = require("path");
let VideoController = class VideoController {
    streamVideo(req, res) {
        const filename = req.params.filename;
        const getContentType = (filename) => {
            const ext = filename.toLowerCase().split('.').pop();
            switch (ext) {
                case 'mp4':
                    return 'video/mp4';
                case 'webm':
                    return 'video/webm';
                case 'ogg':
                    return 'video/ogg';
                default:
                    return null;
            }
        };
        const contentType = getContentType(filename);
        if (!contentType) {
            return res.status(common_1.HttpStatus.BAD_REQUEST).send('Unsupported video format');
        }
        const filePath = (0, path_1.join)(process.cwd(), 'public', 'video', filename);
        let videoStats;
        try {
            videoStats = (0, fs_2.statSync)(filePath);
        }
        catch {
            return res.status(common_1.HttpStatus.NOT_FOUND).send('Видео не найдено');
        }
        const fileSize = videoStats?.size;
        const range = req.headers.range;
        if (!range) {
            res.header({
                'Content-Type': contentType,
                'Content-Length': fileSize,
            });
            (0, fs_1.createReadStream)(filePath).pipe(res);
            return;
        }
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        if (start >= fileSize) {
            return res
                .status(common_1.HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                .header('Content-Range', `bytes */${fileSize}`)
                .send('Requested range not satisfiable');
        }
        const chunkSize = end - start + 1;
        res.header({
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Cache-Control': 'public, max-age=31536000',
        });
        res.status(common_1.HttpStatus.PARTIAL_CONTENT);
        (0, fs_1.createReadStream)(filePath, { start, end }).pipe(res);
    }
};
exports.VideoController = VideoController;
__decorate([
    (0, common_1.Get)(':filename'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], VideoController.prototype, "streamVideo", null);
exports.VideoController = VideoController = __decorate([
    (0, common_1.Controller)('video')
], VideoController);
//# sourceMappingURL=video.controller.js.map