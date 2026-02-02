import { Module } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { AdminJwtGuard } from 'src/auth/admin-jwt.guard';
import { AdminAuthModule } from 'src/auth/admin-auth.module';

@Module({
  imports:[AdminAuthModule],
  controllers: [CarsController],
  providers: [CarsService, AdminJwtGuard],
})
export class CarsModule { }
