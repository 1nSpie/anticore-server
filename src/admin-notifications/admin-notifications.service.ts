import { Injectable, Logger } from "@nestjs/common";
import * as webpush from "web-push";
import { StaffRole } from "../../generated/prisma/client";
import { staffIdFromSubject } from "../auth/admin-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminEventsGateway } from "./admin-events.gateway";

const select = { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true } as const;

export const AdminNotificationType = { LEAD_NEW: "LEAD_NEW" } as const;

export interface AdminNotificationInput {
  type: (typeof AdminNotificationType)[keyof typeof AdminNotificationType];
  title: string;
  body?: string | null;
  /** Путь внутри админки, например `/admin/leads`. */
  link?: string | null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);
  private readonly pushReady: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: AdminEventsGateway,
  ) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    this.pushReady = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
    if (this.pushReady) {
      webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@example.com", VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
    } else {
      this.logger.warn("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY не заданы — push отключён, лента и всплывающие окна работают");
    }
  }

  get publicKey(): string | null {
    return this.pushReady ? process.env.VAPID_PUBLIC_KEY! : null;
  }

  /**
   * Уведомить всех администраторов: лента, всплывающее окно (WebSocket), push на устройства.
   * Не бросает исключений: сбой уведомления не должен ломать приём заявки.
   */
  async notify(input: AdminNotificationInput): Promise<void> {
    try {
      const row = await this.prisma.adminNotification.create({
        data: { type: input.type, title: input.title, body: input.body ?? null, link: input.link ?? null },
        select,
      });
      try {
        this.events.emitToAdmins("notification", row);
      } catch (e) {
        this.logger.warn(`Не удалось отправить по WebSocket: ${(e as Error).message}`);
      }
      await this.push({ title: input.title, body: input.body ?? "", url: input.link ?? "/admin", tag: `${input.type}:${row.id}` });
    } catch (e) {
      this.logger.error(`Не удалось создать уведомление ${input.type}: ${(e as Error).message}`);
    }
  }

  async list(limit = 50) {
    const [items, unread] = await Promise.all([
      this.prisma.adminNotification.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(limit, 100), select }),
      this.prisma.adminNotification.count({ where: { readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(id: number) {
    await this.prisma.adminNotification.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }

  async markAllRead() {
    const r = await this.prisma.adminNotification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }

  async subscribe(subject: string, sub: PushSubscriptionInput) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { p256dh: sub.p256dh, auth: sub.auth, subject },
      create: { ...sub, subject },
    });
    return { success: true };
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { success: true };
  }

  /** Подписки действующих администраторов: разжалованный или заблокированный сотрудник push больше не получает. */
  private async activeSubscriptions() {
    const subs = await this.prisma.pushSubscription.findMany();
    const staffIds = [...new Set(subs.map((s) => staffIdFromSubject(s.subject)).filter((id): id is number => id !== null))];
    const allowed = new Set(
      (
        await this.prisma.staff.findMany({
          where: { id: { in: staffIds }, role: StaffRole.ADMIN, blockedAt: null },
          select: { id: true },
        })
      ).map((s) => s.id),
    );
    return subs.filter((s) => {
      const id = staffIdFromSubject(s.subject);
      return id === null ? s.subject === "admin" : allowed.has(id);
    });
  }

  private async push(payload: { title: string; body: string; url: string; tag: string }) {
    if (!this.pushReady) return;
    const subs = await this.activeSubscriptions();
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
