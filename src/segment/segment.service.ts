import { Injectable } from '@nestjs/common';
import { BodyTypePrice } from '@prisma/client';

@Injectable()
export class SegmentService {
  findOne(id: number): BodyTypePrice {
    return this.findOne(id);
  }
}
