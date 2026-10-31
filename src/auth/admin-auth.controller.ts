// src/admin/admin-auth.controller.ts
// Вход (`POST /admin/login`) и `GET /admin/me` — в `staff/session.controller.ts`: он отличает администратора от мастера.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';

@Controller('admin')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Get('check-auth')
  @UseGuards(AdminJwtGuard)
  @HttpCode(HttpStatus.OK)
  checkAuth() {
    return {
      success: true,
      message: 'Авторизация действительна',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logout')
  @UseGuards(AdminJwtGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Res() res: Response) {
    try {
      // Очищаем куку
      res.clearCookie('admin_token', {
        httpOnly: true,
        path: '/',
      });

      return res.json({
        success: true,
        message: 'Выход выполнен успешно',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Ошибка при выходе',
        timestamp: new Date().toISOString(),
      });
    }
  }
}