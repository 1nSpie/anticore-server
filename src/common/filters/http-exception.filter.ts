import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from 'generated/prisma';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // Список путей, которые часто используют боты - не логируем их
  private readonly botPaths = [
    '/pdown',
    '/_next',
    '/_next/server',
    '/app',
    '/api/route',
    '/wp-admin',
    '/wp-login',
    '/.env',
    '/.git',
    '/admin',
    '/phpmyadmin',
    '/.well-known',
    '/favicon.ico', // favicon запрашивают браузеры автоматически
  ];

  // Проверка, является ли запрос от бота
  private isBotRequest(request: Request): boolean {
    const userAgent = request.get('user-agent')?.toLowerCase() || '';
    const path = request.url.toLowerCase();

    // Проверка User-Agent ботов
    const botPatterns = [
      'bot',
      'crawler',
      'spider',
      'scraper',
      'curl',
      'wget',
      'python',
      'go-http',
      'java',
      'scrapy',
    ];

    const isBotUA = botPatterns.some((pattern) => userAgent.includes(pattern));

    // Проверка подозрительных путей
    const isBotPath = this.botPaths.some((botPath) => path.includes(botPath));

    // POST запросы на несуществующие пути - обычно боты
    const isSuspiciousPost =
      request.method === 'POST' &&
      !path.startsWith('/api/') &&
      !path.startsWith('/static/');

    return isBotUA || isBotPath || isSuspiciousPost;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message =
        typeof errorResponse === 'string'
          ? errorResponse
          : (errorResponse as { message: string }).message || 'Http Exception';
      error = exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Database Error';

      switch ((exception as Prisma.PrismaClientKnownRequestError).code) {
        case 'P2002':
          message = 'Запись с такими данными уже существует';
          break;
        case 'P2025':
          message = 'Запись не найдена';
          status = HttpStatus.NOT_FOUND;
          break;
        case 'P2003':
          message = 'Нарушение внешнего ключа';
          break;
        default:
          message = 'Ошибка базы данных';
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      error = exception.name;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Внутренняя ошибка сервера';
      error = 'Internal Server Error';
    }

    const isBot = this.isBotRequest(request);
    const is404 = status === HttpStatus.NOT_FOUND;
    const isIgnoredPath = this.botPaths.some((p) => 
      request.url.toLowerCase().includes(p.toLowerCase())
    );

    // Не логируем ботов, 404 для известных бот-путей и favicon
    if (!isBot && !(is404 && isIgnoredPath)) {
      const errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message,
        error,
      };

      this.logger.error(
        `${request.method} ${request.url}`,
        JSON.stringify(errorResponse),
      );
    }

    // Для ботов и игнорируемых путей возвращаем простой ответ без JSON (быстрее)
    if ((isBot || isIgnoredPath) && is404) {
      response.status(status).send('Not Found');
      return;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    });
  }
}
