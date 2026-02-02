import {
  Controller,
  Get,
  Param,
  Put,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdatePriceDto } from './dto/price.dto';
import { AdminJwtGuard } from 'src/auth/admin-jwt.guard';

@Controller('segment')
export class SegmentController {
  constructor(private readonly prisma: PrismaService) { }

  @Get()
  async findAll() {
    return this.prisma.bodyTypePrice.findMany({
      orderBy: { segment: 'asc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error('id is not a number');
    }
    return this.prisma.bodyTypePrice.findFirst({
      where: {
        id: numericId,
      },
    });
  }

  @Get('by-segment/:segment')
  findBySegment(@Param('segment', ParseIntPipe) segment: number) {
    return this.prisma.bodyTypePrice.findFirst({
      where: { segment },
    });
  }

  // Admin endpoints
  @UseGuards(AdminJwtGuard)
  @Put(':id')
  async updatePrice(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdatePriceDto,
  ) {
    return this.prisma.bodyTypePrice.update({
      where: { id },
      data: updateDto,
    });
  }

  @UseGuards(AdminJwtGuard)
  @Put('by-segment/:segment')
  async updatePriceBySegment(
    @Param('segment', ParseIntPipe) segment: number,
    @Body() updateDto: UpdatePriceDto,
  ) {
    return this.prisma.bodyTypePrice.upsert({
      where: { segment },
      update: updateDto,
      create: {
        segment,
        ...updateDto,
      },
    });
  }
}
