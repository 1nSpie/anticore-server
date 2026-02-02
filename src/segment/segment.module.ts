import { Module } from '@nestjs/common';
import { SegmentService } from './segment.service';
import { SegmentController } from './segment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [SegmentController],
  providers: [SegmentService, AdminJwtGuard],
  exports: [SegmentService],
})
export class SegmentModule {}
