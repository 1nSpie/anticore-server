import { Injectable } from '@nestjs/common';
import { Car } from '../../generated/prisma/client';

@Injectable()
export class BrandsService {
  findAllCarWithBrand(): Car[] {
    return this.findAllCarWithBrand();
  }
}
