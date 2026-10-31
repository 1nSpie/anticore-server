import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Request } from "express";
import { StaffRole } from "../../generated/prisma/client";
import { mskDayStart } from "../crm/common/crm-work-hours";
import { PrismaService } from "../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "./staff-audit.service";
import { toMasterVisit } from "./master-visit.mapper";
import { NotificationType, fmtMsk, MASTER_HOME } from "./notification-types";
import { NotificationsService } from "./notifications.service";

const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 62;

@Injectable()
export class StaffAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Админ: задать мастеров записи (кнопка «Назначить мастера» в календаре). */
  async setAssignees(visitId: number, staffIds: number[], req: Request) {
    const visit = await this.prisma.visitHistory.findUnique({
      where: { id: visitId },
      select: { id: true, startsAt: true, serviceType: true, assignees: { select: { staffId: true } } },
    });
    if (!visit) throw new NotFoundException("Запись не найдена");

    const current = new Set(visit.assignees.map((a) => a.staffId));
    const added = staffIds.filter((id) => !current.has(id));
    const removed = [...current].filter((id) => !staffIds.includes(id));

    // Проверяем только новых: уже назначенного, но потом заблокированного, можно снять.
    if (added.length) {
      const found = await this.prisma.staff.findMany({
        where: { id: { in: added } },
        select: { id: true, role: true, blockedAt: true, fullName: true },
      });
      if (found.length !== added.length) throw new BadRequestException("Сотрудник не найден");
      const bad = found.find((s) => s.role !== StaffRole.MASTER || s.blockedAt);
      if (bad) throw new BadRequestException(`«${bad.fullName}» нельзя назначить: не мастер или заблокирован`);
    }

    await this.prisma.$transaction([
      this.prisma.visitStaff.deleteMany({ where: { visitId, staffId: { in: removed } } }),
      this.prisma.visitStaff.createMany({
        data: added.map((staffId) => ({ visitId, staffId })),
        skipDuplicates: true,
      }),
    ]);

    if (added.length || removed.length) {
      await this.audit.log({
        action: StaffAuditAction.ASSIGNMENT_CHANGED,
        actor: adminActor(req),
        req,
        meta: { visitId, added, removed },
      });
      const what = `${visit.serviceType}${visit.startsAt ? `, ${fmtMsk(visit.startsAt)}` : ""}`;
      await this.notifications.notify(added, { type: NotificationType.ASSIGNED, title: "Вас назначили на запись", body: what, link: MASTER_HOME });
      await this.notifications.notify(removed, { type: NotificationType.UNASSIGNED, title: "Вас сняли с записи", body: what, link: MASTER_HOME });
    }

    const rows = await this.prisma.visitStaff.findMany({
      where: { visitId },
      orderBy: { assignedAt: "asc" },
      select: { staff: { select: { id: true, fullName: true } } },
    });
    return { assignees: rows.map((r) => r.staff) };
  }

  /** Мастер: только свои записи за период (по умолчанию — сегодня и 14 дней вперёд, по Москве). */
  async scheduleFor(staffId: number, from?: string, to?: string) {
    const now = new Date();
    const start = from ? new Date(from) : mskDayStart(now);
    let end = to ? new Date(to) : new Date(start.getTime() + DEFAULT_WINDOW_DAYS * 86_400_000);
    if (end <= start) throw new BadRequestException("Конец периода раньше начала");
    const max = new Date(start.getTime() + MAX_WINDOW_DAYS * 86_400_000);
    if (end > max) end = max;

    const rows = await this.prisma.visitHistory.findMany({
      where: { assignees: { some: { staffId } }, startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: "asc" },
      // user намеренно не запрашиваем — данные клиента мастеру не уходят
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        visitDate: true,
        serviceType: true,
        priceRub: true,
        masterComment: true,
        location: true,
        completedAt: true,
        vehicle: { select: { customLabel: true, vin: true, car: { select: { model: true, brand: { select: { name: true } } } } } },
        siteLead: { select: { status: true } },
      },
    });
    return rows.map((r) => toMasterVisit(r, now));
  }
}
