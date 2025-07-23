import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBlogPostDto,
  UpdateBlogPostDto,
  CreateCategoryDto,
  CreateTagDto,
  BlogQueryDto,
} from './dto/blog.dto';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  // Blog Posts
  async createPost(createPostDto: CreateBlogPostDto) {
    const { tags, ...postData } = createPostDto;

    // Handle tags if provided
    const tagConnections: { id: number }[] = [];
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

  async findAllPosts(query: BlogQueryDto) {
    const { category, tag, featured, limit = 10, offset = 0, search } = query;

    const where: any = {
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

  async findPostById(id: number) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      include: {
        category: true,
        tags: true,
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    return post;
  }

  async findPostBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
      include: {
        category: true,
        tags: true,
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with slug ${slug} not found`);
    }

    return post;
  }

  async updatePost(id: number, updatePostDto: UpdateBlogPostDto) {
    const { tags, ...postData } = updatePostDto;

    // Handle tags if provided
    const tagConnections: { id: number }[] = [];
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

  async deletePost(id: number) {
    return this.prisma.blogPost.delete({
      where: { id },
    });
  }

  async getRelatedPosts(postId: number, categoryId: number, limit = 3) {
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

  // Categories
  async createCategory(createCategoryDto: CreateCategoryDto) {
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

  async findCategoryById(id: number) {
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
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  // Tags
  async createTag(createTagDto: CreateTagDto) {
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
    const [totalPosts, totalCategories, totalTags, featuredPosts] =
      await Promise.all([
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
}
