import { Injectable } from '@nestjs/common';
import { BodyTypePrice } from 'generated/prisma';

@Injectable()
export class SegmentService {
  findOne(id: number): BodyTypePrice {
    return this.findOne(id);
  }
}
