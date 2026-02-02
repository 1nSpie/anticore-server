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

  // Список User-Agent ботов (curl, postman, insomnia убраны для удобства разработки)
  private readonly botUserAgents = [
    'bot',
    'crawler',
    'spider',
    'scraper',
    'wget',
    'go-http',
    'scrapy',
  ];

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.url.toLowerCase();
    const userAgent = req.get('user-agent')?.toLowerCase() || '';

    // Пропускаем /api/ и /static/ пути без проверки
    if (path.startsWith('/api/') || path.startsWith('/static/')) {
      return next();
    }

    // Быстрая проверка - является ли это бот-запрос
    const isBotPath = this.botPaths.some((botPath) => path.includes(botPath));
    const isBotUA = this.botUserAgents.some((bot) => userAgent.includes(bot));
    
    // POST запросы на несуществующие пути - обычно боты
    const isSuspiciousPost = req.method === 'POST' && path !== '/';

    // Если это явно бот - быстро отклоняем без обработки
    if (isBotPath || isBotUA || isSuspiciousPost) {
      return res.status(404).send('Not Found');
    }

    next();
  }
}

