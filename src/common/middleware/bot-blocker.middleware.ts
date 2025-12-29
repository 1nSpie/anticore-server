import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class BotBlockerMiddleware implements NestMiddleware {
  // Список путей, которые часто используют боты
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
    '/favicon.ico', // favicon тоже часто запрашивают боты
  ];

  // Список User-Agent ботов
  private readonly botUserAgents = [
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
    'postman',
    'insomnia',
  ];

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.url.toLowerCase();
    const userAgent = req.get('user-agent')?.toLowerCase() || '';

    // Быстрая проверка - является ли это бот-запрос
    const isBotPath = this.botPaths.some((botPath) => path.includes(botPath));
    const isBotUA = this.botUserAgents.some((bot) => userAgent.includes(bot));
    
    // POST запросы на несуществующие пути (не /api и не /static) - обычно боты
    const isSuspiciousPost =
      req.method === 'POST' &&
      !path.startsWith('/api/') &&
      !path.startsWith('/static/') &&
      path !== '/';

    // Если это явно бот - быстро отклоняем без обработки
    if ((isBotPath || isBotUA || isSuspiciousPost) && !path.startsWith('/api/') && !path.startsWith('/static/')) {
      return res.status(404).send('Not Found');
    }

    next();
  }
}

