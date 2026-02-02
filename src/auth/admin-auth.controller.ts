// src/admin/admin-auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { LoginDto } from './login.dto';

@Controller('admin')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(
    @Body() loginDto: LoginDto,
    @Res() res: Response,
  ) {
    try {
      const isValid = this.adminAuthService.validateCredentials(
        loginDto.login,
        loginDto.password,
      );

      if (!isValid) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'Неверный логин или пароль',
          timestamp: new Date().toISOString(),
        });
      }

      // Создаем токен
      const token = this.adminAuthService.createToken();

      // Также устанавливаем куку (на всякий случай)
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 12 * 60 * 60 * 1000,
        path: '/',
      });

      // Возвращаем токен в теле ответа для сохранения в localStorage
      return res.json({
        success: true,
        token, // <-- ВАЖНО: возвращаем токен!
        message: 'Авторизация успешна',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: error.message || 'Ошибка авторизации',
        timestamp: new Date().toISOString(),
      });
    }
  }

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