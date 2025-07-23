import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { CarsModule } from './cars/cars.module';
import { BrandsModule } from './brands/brands.module';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { SegmentModule } from './segment/segment.module';
import { BlogModule } from './blog/blog.module';
import { WorksModule } from './works/works.module';
import { VideoController } from './video/video.controller';
import { ImageModule } from './image/image.module';
import { StaticModule } from './static/static.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    PrismaModule,
    CarsModule,
    BrandsModule,
    SegmentModule,
    BlogModule,
    WorksModule,
    ImageModule,
    StaticModule,
    TelegramModule,
  ],
  controllers: [VideoController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
