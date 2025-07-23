import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('cars')
export class CarsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAllCars() {
    return this.prisma.car.findMany({
      include: {
        brand: true,
      },
    });
  }

  @Get('brands')
  findAllBrands() {
    return this.prisma.brand.findMany();
  }
}
