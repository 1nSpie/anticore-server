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
exports.BlogController = void 0;
const common_1 = require("@nestjs/common");
const blog_service_1 = require("./blog.service");
const blog_dto_1 = require("./dto/blog.dto");
let BlogController = class BlogController {
    blogService;
    constructor(blogService) {
        this.blogService = blogService;
    }
    createPost(createPostDto) {
        return this.blogService.createPost(createPostDto);
    }
    findAllPosts(query) {
        return this.blogService.findAllPosts(query);
    }
    getFeaturedPost() {
        return this.blogService.getFeaturedPost();
    }
    findPostById(id) {
        return this.blogService.findPostById(id);
    }
    findPostBySlug(slug) {
        return this.blogService.findPostBySlug(slug);
    }
    async getRelatedPosts(id) {
        const post = await this.blogService.findPostById(id);
        return this.blogService.getRelatedPosts(id, post.categoryId);
    }
    updatePost(id, updatePostDto) {
        return this.blogService.updatePost(id, updatePostDto);
    }
    deletePost(id) {
        return this.blogService.deletePost(id);
    }
    createCategory(createCategoryDto) {
        return this.blogService.createCategory(createCategoryDto);
    }
    findAllCategories() {
        return this.blogService.findAllCategories();
    }
    findCategoryById(id) {
        return this.blogService.findCategoryById(id);
    }
    createTag(createTagDto) {
        return this.blogService.createTag(createTagDto);
    }
    findAllTags() {
        return this.blogService.findAllTags();
    }
    getStats() {
        return this.blogService.getStats();
    }
};
exports.BlogController = BlogController;
__decorate([
    (0, common_1.Post)('posts'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [blog_dto_1.CreateBlogPostDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "createPost", null);
__decorate([
    (0, common_1.Get)('posts'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [blog_dto_1.BlogQueryDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "findAllPosts", null);
__decorate([
    (0, common_1.Get)('posts/featured'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "getFeaturedPost", null);
__decorate([
    (0, common_1.Get)('posts/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "findPostById", null);
__decorate([
    (0, common_1.Get)('posts/slug/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "findPostBySlug", null);
__decorate([
    (0, common_1.Get)('posts/:id/related'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], BlogController.prototype, "getRelatedPosts", null);
__decorate([
    (0, common_1.Patch)('posts/:id'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, blog_dto_1.UpdateBlogPostDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "updatePost", null);
__decorate([
    (0, common_1.Delete)('posts/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "deletePost", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [blog_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "findAllCategories", null);
__decorate([
    (0, common_1.Get)('categories/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "findCategoryById", null);
__decorate([
    (0, common_1.Post)('tags'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [blog_dto_1.CreateTagDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "createTag", null);
__decorate([
    (0, common_1.Get)('tags'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "findAllTags", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "getStats", null);
exports.BlogController = BlogController = __decorate([
    (0, common_1.Controller)('blog'),
    __metadata("design:paramtypes", [blog_service_1.BlogService])
], BlogController);
//# sourceMappingURL=blog.controller.js.map