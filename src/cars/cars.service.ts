import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Brand } from '../../generated/prisma/client';

@Injectable()
export class CarsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllBrand(): Promise<Brand[]> {
    return this.prisma.brand.findMany();
  }
}
