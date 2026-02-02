import { Controller, Get, Post, Body, Param, Delete, Patch, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

class CreateCarDto {
  brandId?: number;
  brandName?: string; // Для создания новой марки
  model: string;
  segment: number;
}

class UpdateCarDto {
  brandId?: number;
  model?: string;
  segment?: number;
}

class CreateBrandDto {
  name: string;
}

@Controller('cars')
export class CarsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAllCars(@Query('search') search?: string, @Query('brandId') brandId?: string) {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { model: { contains: search, mode: 'insensitive' } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    
    if (brandId) {
      where.brandId = Number(brandId);
    }

    return this.prisma.car.findMany({
      where,
      include: { brand: true },
      orderBy: [{ brand: { name: 'asc' } }, { model: 'asc' }],
    });
  }

  @Get('brands')
  findAllBrands() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Admin endpoints
  @UseGuards(AdminJwtGuard)
  @Post('brands')
  async createBrand(@Body() dto: CreateBrandDto) {
    return this.prisma.brand.create({
      data: { name: dto.name },
    });
  }

  @UseGuards(AdminJwtGuard)
  @Delete('brands/:id')
  async deleteBrand(@Param('id', ParseIntPipe) id: number) {
    // Сначала удаляем все машины этой марки
    await this.prisma.car.deleteMany({ where: { brandId: id } });
    return this.prisma.brand.delete({ where: { id } });
  }

  @UseGuards(AdminJwtGuard)
  @Post()
  async createCar(@Body() dto: CreateCarDto) {
    let brandId = dto.brandId;

    // Если передано имя марки вместо ID - создаём или находим марку
    if (!brandId && dto.brandName) {
      const existingBrand = await this.prisma.brand.findFirst({
        where: { name: { equals: dto.brandName, mode: 'insensitive' } },
      });

      if (existingBrand) {
        brandId = existingBrand.id;
      } else {
        const newBrand = await this.prisma.brand.create({
          data: { name: dto.brandName },
        });
        brandId = newBrand.id;
      }
    }

    if (!brandId) {
      throw new Error('Необходимо указать марку автомобиля');
    }

    return this.prisma.car.create({
      data: {
        model: dto.model,
        segment: dto.segment,
        brand: { connect: { id: brandId } },
      },
      include: { brand: true },
    });
  }

  @UseGuards(AdminJwtGuard)
  @Patch(':id')
  updateCar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCarDto,
  ) {
    return this.prisma.car.update({
      where: { id },
      data: {
        model: dto.model,
        segment: dto.segment,
        ...(dto.brandId && {
          brand: {
            connect: { id: dto.brandId },
          },
        }),
      },
    });
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  deleteCar(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.car.delete({
      where: { id },
    });
  }
}
