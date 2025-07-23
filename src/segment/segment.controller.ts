import { Controller, Get, Param } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

@Controller('segment')
export class SegmentController {
  constructor(private readonly prisma: PrismaService) {}

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
}
