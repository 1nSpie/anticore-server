import { CreateWorkDto, UpdateWorkDto } from "./dto/work.dto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  createWork(dto: CreateWorkDto) {
    const { images = [], services = [], ...data } = dto;
    return this.prisma.work.create({
      data: {
        ...data,
        images: { create: images },
        services: { create: services.map((name) => ({ name })) },
      },
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: "asc" } },
      },
    });
  }

  updateWork(id: number, dto: UpdateWorkDto) {
    const { images, services, ...data } = dto;
    return this.prisma.work.update({
      where: { id },
      data: {
        ...data,
        ...(images !== undefined && {
          images: { deleteMany: {}, create: images },
        }),
        ...(services !== undefined && {
          services: {
            deleteMany: {},
            create: services.map((name) => ({ name })),
          },
        }),
      },
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: "asc" } },
      },
    });
  }

  deleteWork(id: number) {
    return this.prisma.work.delete({ where: { id } });
  }

  async findAllWorks(
    categoryId?: number,
    featured?: boolean,
    published?: boolean,
  ) {
    const where: any = {};

    if (categoryId) where.categoryId = categoryId;
    if (featured !== undefined) where.featured = featured;
    if (published !== undefined) where.published = published;

    return await this.prisma.work.findMany({
      where,
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findWorkById(id: number) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: "asc" } },
      },
    });

    if (!work || !work.published) {
      throw new NotFoundException(`Work with ID ${id} not found`);
    }

    return work;
  }

  async findWorkBySlug(slug: string) {
    const work = await this.prisma.work.findUnique({
      where: { slug },
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: "asc" } },
      },
    });

    if (!work || !work.published) {
      throw new NotFoundException(`Work with slug ${slug} not found`);
    }

    return work;
  }

  async findAllWorkCategories() {
    return await this.prisma.workCategory.findMany({
      include: {
        works: {
          where: { published: true },
          select: { id: true, title: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async findWorkCategoryById(id: number) {
    const category = await this.prisma.workCategory.findUnique({
      where: { id },
      include: {
        works: {
          where: { published: true },
          include: {
            services: true,
            images: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Work category with ID ${id} not found`);
    }

    return category;
  }

  async getWorksStats() {
    const totalWorks = await this.prisma.work.count();
    const publishedWorks = await this.prisma.work.count({
      where: { published: true },
    });
    const featuredWorks = await this.prisma.work.count({
      where: { featured: true, published: true },
    });

    return {
      totalWorks,
      publishedWorks,
      featuredWorks,
    };
  }
}
