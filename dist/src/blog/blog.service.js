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
exports.BlogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BlogService = class BlogService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createPost(createPostDto) {
        const { tags, ...postData } = createPostDto;
        const tagConnections = [];
        if (tags && tags.length > 0) {
            for (const tagName of tags) {
                const tag = await this.prisma.blogTag.upsert({
                    where: { name: tagName },
                    update: {},
                    create: {
                        name: tagName,
                        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
                    },
                });
                tagConnections.push({ id: tag.id });
            }
        }
        return this.prisma.blogPost.create({
            data: {
                ...postData,
                tags: {
                    connect: tagConnections,
                },
            },
            include: {
                category: true,
                tags: true,
            },
        });
    }
    async findAllPosts(query) {
        const { category, tag, featured, limit = 10, offset = 0, search } = query;
        const where = {
            published: true,
        };
        if (category) {
            where.category = {
                slug: category,
            };
        }
        if (tag) {
            where.tags = {
                some: {
                    slug: tag,
                },
            };
        }
        if (featured !== undefined) {
            where.featured = featured;
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { excerpt: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [posts, total] = await Promise.all([
            this.prisma.blogPost.findMany({
                where,
                include: {
                    category: true,
                    tags: true,
                },
                orderBy: {
                    date: 'desc',
                },
                take: limit,
                skip: offset,
            }),
            this.prisma.blogPost.count({ where }),
        ]);
        return {
            posts,
            total,
            hasMore: offset + limit < total,
        };
    }
    async findPostById(id) {
        const post = await this.prisma.blogPost.findUnique({
            where: { id },
            include: {
                category: true,
                tags: true,
            },
        });
        if (!post) {
            throw new common_1.NotFoundException(`Post with ID ${id} not found`);
        }
        return post;
    }
    async findPostBySlug(slug) {
        const post = await this.prisma.blogPost.findUnique({
            where: { slug },
            include: {
                category: true,
                tags: true,
            },
        });
        if (!post) {
            throw new common_1.NotFoundException(`Post with slug ${slug} not found`);
        }
        return post;
    }
    async updatePost(id, updatePostDto) {
        const { tags, ...postData } = updatePostDto;
        const tagConnections = [];
        if (tags && tags.length > 0) {
            for (const tagName of tags) {
                const tag = await this.prisma.blogTag.upsert({
                    where: { name: tagName },
                    update: {},
                    create: {
                        name: tagName,
                        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
                    },
                });
                tagConnections.push({ id: tag.id });
            }
        }
        return this.prisma.blogPost.update({
            where: { id },
            data: {
                ...postData,
                ...(tags && {
                    tags: {
                        set: tagConnections,
                    },
                }),
            },
            include: {
                category: true,
                tags: true,
            },
        });
    }
    async deletePost(id) {
        return this.prisma.blogPost.delete({
            where: { id },
        });
    }
    async getRelatedPosts(postId, categoryId, limit = 3) {
        return this.prisma.blogPost.findMany({
            where: {
                id: { not: postId },
                categoryId,
                published: true,
            },
            include: {
                category: true,
                tags: true,
            },
            orderBy: {
                date: 'desc',
            },
            take: limit,
        });
    }
    async createCategory(createCategoryDto) {
        return this.prisma.blogCategory.create({
            data: createCategoryDto,
        });
    }
    async findAllCategories() {
        return this.prisma.blogCategory.findMany({
            include: {
                _count: {
                    select: {
                        posts: {
                            where: { published: true },
                        },
                    },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });
    }
    async findCategoryById(id) {
        const category = await this.prisma.blogCategory.findUnique({
            where: { id },
            include: {
                posts: {
                    where: { published: true },
                    include: {
                        category: true,
                        tags: true,
                    },
                },
            },
        });
        if (!category) {
            throw new common_1.NotFoundException(`Category with ID ${id} not found`);
        }
        return category;
    }
    async createTag(createTagDto) {
        return this.prisma.blogTag.create({
            data: createTagDto,
        });
    }
    async findAllTags() {
        return this.prisma.blogTag.findMany({
            include: {
                _count: {
                    select: {
                        posts: {
                            where: { published: true },
                        },
                    },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });
    }
    async getFeaturedPost() {
        return this.prisma.blogPost.findFirst({
            where: {
                featured: true,
                published: true,
            },
            include: {
                category: true,
                tags: true,
            },
            orderBy: {
                date: 'desc',
            },
        });
    }
    async getStats() {
        const [totalPosts, totalCategories, totalTags, featuredPosts] = await Promise.all([
            this.prisma.blogPost.count({ where: { published: true } }),
            this.prisma.blogCategory.count(),
            this.prisma.blogTag.count(),
            this.prisma.blogPost.count({
                where: { featured: true, published: true },
            }),
        ]);
        return {
            totalPosts,
            totalCategories,
            totalTags,
            featuredPosts,
        };
    }
};
exports.BlogService = BlogService;
exports.BlogService = BlogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BlogService);
//# sourceMappingURL=blog.service.js.map