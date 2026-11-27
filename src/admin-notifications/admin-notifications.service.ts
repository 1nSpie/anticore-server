import { Injectable, Logger } from "@nestjs/common";
import { StaffRole } from "../../generated/prisma/client";
import { staffIdFromSubject } from "../auth/admin-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { PushService, type PushSubscriptionInput } from "../push/push.service";
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

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: AdminEventsGateway,
    private readonly pushes: PushService,
  ) {}

  get publicKey(): string | null {
    return this.pushes.publicKey;
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
      await this.pushToAdmins({ title: input.title, body: input.body ?? "", url: input.link ?? "/admin", tag: `${input.type}:${row.id}` });
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

  subscribe(subject: string, sub: PushSubscriptionInput) {
    return this.pushes.subscribe(subject, sub);
  }

  unsubscribe(subject: string, endpoint: string) {
    return this.pushes.unsubscribe(subject, endpoint);
  }

  /** Подписки действующих администраторов: разжалованный или заблокированный сотрудник push больше не получает. */
  private async activeSubscriptions() {
    const subs = await this.pushes.listAll();
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

  private async pushToAdmins(payload: { title: string; body: string; url: string; tag: string }) {
    if (!this.pushes.enabled) return;
    await this.pushes.send(await this.activeSubscriptions(), payload);
  }
}
