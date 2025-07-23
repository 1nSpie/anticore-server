import { Injectable } from '@nestjs/common';
import { Brand } from 'generated/prisma';

@Injectable()
export class CarsService {
  findAllBrand(): Brand[] {
    return this.findAllBrand();
  }
}
