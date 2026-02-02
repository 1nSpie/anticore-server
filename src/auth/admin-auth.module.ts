// src/admin/admin-auth.module.ts
import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';

@Module({
  controllers: [AdminAuthController],
  providers: [
    AdminAuthService,
    AdminJwtGuard,
  ],
  exports: [
    AdminAuthService,
    AdminJwtGuard,
  ],
})
export class AdminAuthModule {}