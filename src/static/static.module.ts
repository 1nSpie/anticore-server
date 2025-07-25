import { Module } from '@nestjs/common';
import { StaticController } from './static.controller';
import { ImageOptimizationService } from './image-optimization.service';

@Module({
  controllers: [StaticController],
  providers: [ImageOptimizationService],
  exports: [ImageOptimizationService],
})
export class StaticModule {}
