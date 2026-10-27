import { Throttle } from "@nestjs/throttler";

/**
 * Лимиты запросов (на IP, по маршруту) для зон, закрытых авторизацией.
 * Общий лимит приложения (40/мин, см. `app.module.ts`) остаётся для публичных эндпоинтов — форм сайта, каталога, входа клиента:
 * он защищает от спама, а админку и кабинет мастера он душил (календарь, списки и опрос статусов делают много запросов).
 */
export const ADMIN_RATE = { limit: 600, ttl: 60_000 } as const;

/** Мастера работают из одного цеха — обычно с одного Wi-Fi и одного внешнего IP, поэтому лимит общий на всех, и он выше. */
export const STAFF_RATE = { limit: 1200, ttl: 60_000 } as const;

/** Попытки входа мастера: 30 за 15 минут с IP (цех = один IP). Перебор конкретного логина отдельно режется в сервисе: 5 неудач / 15 мин. */
export const STAFF_LOGIN_RATE = { limit: 30, ttl: 15 * 60_000 } as const;

export const AdminThrottle = () => Throttle({ default: { ...ADMIN_RATE } });
export const StaffThrottle = () => Throttle({ default: { ...STAFF_RATE } });
