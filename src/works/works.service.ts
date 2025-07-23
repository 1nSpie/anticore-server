import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkDto, UpdateWorkDto, CreateWorkCategoryDto, UpdateWorkCategoryDto } from './dto/work.dto';

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  // Works CRUD operations
  async createWork(createWorkDto: CreateWorkDto) {
    const { services, images, ...workData } = createWorkDto;
    
    return await this.prisma.work.create({
      data: {
        ...workData,
        services: services ? {
          create: services.map(service => ({ name: service }))
        } : undefined,
        images: images ? {
          create: images.map(image => ({
            url: image.url,
            alt: image.alt,
            order: image.order || 0
          }))
        } : undefined
      },
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: 'asc' } }
      }
    });
  }

  async findAllWorks(categoryId?: number, featured?: boolean, published?: boolean) {
    const where: any = {};
    
    if (categoryId) where.categoryId = categoryId;
    if (featured !== undefined) where.featured = featured;
    if (published !== undefined) where.published = published;

    return await this.prisma.work.findMany({
      where,
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findWorkById(id: number) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: 'asc' } }
      }
    });

    if (!work) {
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
        images: { orderBy: { order: 'asc' } }
      }
    });

    if (!work) {
      throw new NotFoundException(`Work with slug ${slug} not found`);
    }

    return work;
  }

  async updateWork(id: number, updateWorkDto: UpdateWorkDto) {
    const { services, images, ...workData } = updateWorkDto;
    
    // First, update the work
    const work = await this.prisma.work.update({
      where: { id },
      data: workData,
      include: {
        category: true,
        services: true,
        images: { orderBy: { order: 'asc' } }
      }
    });

    // Update services if provided
    if (services) {
      await this.prisma.workService.deleteMany({
        where: { workId: id }
      });
      
      await this.prisma.workService.createMany({
        data: services.map(service => ({
          workId: id,
          name: service
        }))
      });
    }

    // Update images if provided
    if (images) {
      await this.prisma.workImage.deleteMany({
        where: { workId: id }
      });
      
      await this.prisma.workImage.createMany({
        data: images.map(image => ({
          workId: id,
          url: image.url,
          alt: image.alt,
          order: image.order || 0
        }))
      });
    }

    return await this.findWorkById(id);
  }

  async deleteWork(id: number) {
    await this.findWorkById(id); // Check if exists
    
    return await this.prisma.work.delete({
      where: { id }
    });
  }

  // Work Categories CRUD operations
  async createWorkCategory(createCategoryDto: CreateWorkCategoryDto) {
    return await this.prisma.workCategory.create({
      data: createCategoryDto
    });
  }

  async findAllWorkCategories() {
    return await this.prisma.workCategory.findMany({
      include: {
        works: {
          where: { published: true },
          select: { id: true, title: true }
        }
      },
      orderBy: { name: 'asc' }
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
            images: { orderBy: { order: 'asc' } }
          }
        }
      }
    });

    if (!category) {
      throw new NotFoundException(`Work category with ID ${id} not found`);
    }

    return category;
  }

  async updateWorkCategory(id: number, updateCategoryDto: UpdateWorkCategoryDto) {
    await this.findWorkCategoryById(id); // Check if exists
    
    return await this.prisma.workCategory.update({
      where: { id },
      data: updateCategoryDto
    });
  }

  async deleteWorkCategory(id: number) {
    await this.findWorkCategoryById(id); // Check if exists
    
    return await this.prisma.workCategory.delete({
      where: { id }
    });
  }

  // Stats
  async getWorksStats() {
    const totalWorks = await this.prisma.work.count();
    const publishedWorks = await this.prisma.work.count({
      where: { published: true }
    });
    const featuredWorks = await this.prisma.work.count({
      where: { featured: true, published: true }
    });

    return {
      totalWorks,
      publishedWorks,
      featuredWorks
    };
  }
}
