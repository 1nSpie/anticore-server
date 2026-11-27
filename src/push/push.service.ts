import { Injectable, Logger } from "@nestjs/common";
import * as webpush from "web-push";
import { PrismaService } from "../prisma/prisma.service";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Внутренний путь, куда ведёт нажатие. */
  url: string;
  /** Одинаковый tag заменяет, а не дублирует уведомление. */
  tag: string;
}

/** Общая часть Web Push для админов и мастеров: подписки устройств и отправка по VAPID. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  readonly enabled: boolean;

  constructor(private readonly prisma: PrismaService) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    this.enabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
    if (this.enabled) {
      webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@example.com", VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
    } else {
      this.logger.warn("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY не заданы — push отключён, лента и всплывающие окна работают");
    }
  }

  get publicKey(): string | null {
    return this.enabled ? process.env.VAPID_PUBLIC_KEY! : null;
  }

  /** `subject`: `admin` (env-админ) или `staff:<id>`. Устройство одно — подписка одна: повторная переписывает владельца. */
  async subscribe(subject: string, sub: PushSubscriptionInput) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { p256dh: sub.p256dh, auth: sub.auth, subject },
      create: { ...sub, subject },
    });
    return { success: true };
  }

  /** Только свою подписку: чужой endpoint этим вызовом не удалить. */
  async unsubscribe(subject: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, subject } });
    return { success: true };
  }

  listAll() {
    return this.prisma.pushSubscription.findMany();
  }

  listForSubjects(subjects: string[]) {
    return this.prisma.pushSubscription.findMany({ where: { subject: { in: subjects } } });
  }

  async send(subs: { endpoint: string; p256dh: string; auth: string }[], payload: PushPayload) {
    if (!this.enabled || !subs.length) return;
    const message = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 60 * 60 });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410 — подписка отозвана или устройство удалило приложение
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } });
          } else {
            this.logger.warn(`Push не доставлен (${status ?? "?"}): ${(e as Error).message}`);
          }
        }
      }),
    );
  }
}
