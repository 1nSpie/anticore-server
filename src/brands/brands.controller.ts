import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('brands')
export class BrandsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async findAllCarWithBrand(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error('ID бренда должен быть числом');
    }

    // Шаг 1: Получаем все машины бренда
    const cars = await this.prisma.car.findMany({
      where: {
        brandId: numericId,
      },
    });

    // Шаг 2: Собираем уникальные сегменты
    const segments = [...new Set(cars.map((car) => car.segment))] as number[];

    // Шаг 3: Получаем все цены по этим сегментам
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const priceRecords = await this.prisma.bodyTypePrice.findMany({
      where: {
        segment: {
          in: segments,
        },
      },
    });

    // Шаг 4: Объединяем данные
    const carsWithPrices = cars.map((car) => {
      const priceInfo = priceRecords?.find((p) => p.segment === car.segment);

      return {
        ...car,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        prices: priceInfo || null,
      };
    });

    return carsWithPrices;
  }
}
