import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { CarsModule } from './cars/cars.module';
import { BrandsModule } from './brands/brands.module';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { BotBlockerMiddleware } from './common/middleware/bot-blocker.middleware';
import { SegmentModule } from './segment/segment.module';
import { BlogModule } from './blog/blog.module';
import { WorksModule } from './works/works.module';
import { VideoController } from './video/video.controller';
import { ImageModule } from './image/image.module';
import { StaticModule } from './static/static.module';
import { TelegramModule } from './telegram/telegram.module';
import { LegacyModule } from './legacy/legacy.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { VkModule } from './vk/vk.module';
import { SmsModule } from './cabinet/sms/sms.module';
import { CabinetAuthModule } from './cabinet/auth/cabinet-auth.module';
import { CabinetUserModule } from './cabinet/user/cabinet-user.module';
import { CabinetAdminModule } from './cabinet/admin/cabinet-admin.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 минута
        limit: 40, // 100 запросов в минуту
      },
    ]),
    PrismaModule,
    CarsModule,
    BrandsModule,
    SegmentModule,
    BlogModule,
    WorksModule,
    ImageModule,
    StaticModule,
    TelegramModule,
    LegacyModule,
    AdminAuthModule,
    VkModule,
    SmsModule,
    CabinetAuthModule,
    CabinetUserModule,
    CabinetAdminModule,
  ],
  controllers: [VideoController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Применяем блокировку ботов ко всем маршрутам
    consumer.apply(BotBlockerMiddleware).forRoutes('*');
  }
}
