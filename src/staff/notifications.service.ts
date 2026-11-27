import { Injectable, Logger } from "@nestjs/common";
import { StaffRole } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PushService } from "../push/push.service";
import { MASTER_HOME, NotificationInput } from "./notification-types";
import { StaffEventsGateway } from "./staff-events.gateway";

const select = { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true } as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: StaffEventsGateway,
    private readonly pushes: PushService,
  ) {}

  /**
   * Создать уведомление каждому из мастеров и сразу показать онлайн (pop-up).
   * Не бросает исключений: сбой уведомления не должен ломать бизнес-операцию (назначение, правку записи…).
   */
  async notify(staffIds: number[], input: NotificationInput): Promise<void> {
    const ids = [...new Set(staffIds)].filter((id) => Number.isInteger(id));
    if (!ids.length) return;
    try {
      const rows = await Promise.all(
        ids.map((staffId) =>
          this.prisma.notification.create({
            data: { staffId, type: input.type, title: input.title, body: input.body ?? null, link: input.link ?? null },
            select,
          }),
        ),
      );
      rows.forEach((row, i) => {
        try {
          this.events.emitToStaff(ids[i], "notification", row);
        } catch (e) {
          this.logger.warn(`Не удалось отправить по WebSocket: ${(e as Error).message}`);
        }
      });
      await this.pushToStaff(ids, input);
    } catch (e) {
      this.logger.error(`Не удалось создать уведомление ${input.type}: ${(e as Error).message}`);
    }
  }

  /** Push на устройства мастеров (приложение закрыто). Сбой доставки уведомление не отменяет. */
  private async pushToStaff(staffIds: number[], input: NotificationInput) {
    if (!this.pushes.enabled) return;
    try {
      const subs = await this.pushes.listForSubjects(staffIds.map((id) => `staff:${id}`));
      await this.pushes.send(subs, { title: input.title, body: input.body ?? "", url: input.link ?? MASTER_HOME, tag: `${input.type}:${input.link ?? ""}` });
    } catch (e) {
      this.logger.warn(`Push мастерам не отправлен: ${(e as Error).message}`);
    }
  }

  /** Всем активным мастерам (например, «регламент изменён»). */
  async notifyAllMasters(input: NotificationInput): Promise<void> {
    try {
      const masters = await this.prisma.staff.findMany({
        where: { role: StaffRole.MASTER, blockedAt: null },
        select: { id: true },
      });
      await this.notify(masters.map((m) => m.id), input);
    } catch (e) {
      this.logger.error(`Рассылка ${input.type} не удалась: ${(e as Error).message}`);
    }
  }

  async list(staffId: number, limit = 50) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { staffId }, orderBy: { createdAt: "desc" }, take: Math.min(limit, 100), select }),
      this.prisma.notification.count({ where: { staffId, readAt: null } }),
    ]);
    return { items, unread };
  }

  /** Чужое уведомление «прочитать» нельзя: фильтр по staffId в самом запросе. */
  async markRead(staffId: number, id: number) {
    await this.prisma.notification.updateMany({ where: { id, staffId, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }

  async markAllRead(staffId: number) {
    const r = await this.prisma.notification.updateMany({ where: { staffId, readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }
}
