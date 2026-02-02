import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [BlogController],
  providers: [BlogService, AdminJwtGuard],
})
export class BlogModule {}
