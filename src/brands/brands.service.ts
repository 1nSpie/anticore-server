import { Injectable } from '@nestjs/common';
import { Car } from 'generated/prisma';

@Injectable()
export class BrandsService {
  findAllCarWithBrand(): Car[] {
    return this.findAllCarWithBrand();
  }
}
