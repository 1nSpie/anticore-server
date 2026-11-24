import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Request } from "express";
import { PayrollRole, StaffRole } from "../../generated/prisma/client";
import { mskDayStart } from "../crm/common/crm-work-hours";
import { PrismaService } from "../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "../staff/staff-audit.service";
import { CreateBonusTypeDto, PayrollReportQueryDto, UpdateBonusTypeDto, UpdatePayrollSettingsDto } from "./dto/payroll.dto";
import { closingChecklist, entryTotal } from "./payroll.rules";

const DAY_MS = 86_400_000;

const entryInclude = {
  bonuses: { orderBy: { id: "asc" as const } },
} as const;

/**
 * Зарплата по записям: ставка копируется при назначении мастера/приёмщика, «начислено» становится после закрытия
 * машины (`CrmAppointmentsService.complete`), доп. выплаты отмечает управляющий уже после закрытия.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
  ) {}

  // --- Настройки ---

  async getSettings() {
    const row = await this.prisma.payrollSettings.findUnique({ where: { id: 1 } });
    return { masterBaseRub: row?.masterBaseRub ?? 0, receiverBaseRub: row?.receiverBaseRub ?? 0 };
  }

  async updateSettings(dto: UpdatePayrollSettingsDto, req: Request) {
    const before = await this.getSettings();
    await this.prisma.payrollSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...dto },
      update: dto,
    });
    await this.audit.log({ action: StaffAuditAction.PAYROLL_SETTINGS_CHANGED, actor: adminActor(req), req, meta: { before, after: { ...dto } } });
    return this.getSettings();
  }

  listBonusTypes() {
    return this.prisma.payrollBonusType.findMany({ orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { id: "asc" }] });
  }

  async createBonusType(dto: CreateBonusTypeDto, req: Request) {
    const row = await this.prisma.payrollBonusType.create({ data: dto });
    await this.audit.log({ action: StaffAuditAction.PAYROLL_BONUS_TYPE_CHANGED, actor: adminActor(req), req, meta: { id: row.id, created: { ...dto } } });
    return row;
  }

  async updateBonusType(id: number, dto: UpdateBonusTypeDto, req: Request) {
    const exists = await this.prisma.payrollBonusType.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Тип выплаты не найден");
    const row = await this.prisma.payrollBonusType.update({ where: { id }, data: dto });
    await this.audit.log({ action: StaffAuditAction.PAYROLL_BONUS_TYPE_CHANGED, actor: adminActor(req), req, meta: { id, changes: { ...dto } } });
    return row;
  }

  // --- Начисления по записи ---

  /** Копия ставки на момент назначения: смена настроек старые начисления не трогает. */
  private async rateFor(role: PayrollRole): Promise<number> {
    const s = await this.getSettings();
    return role === PayrollRole.MASTER ? s.masterBaseRub : s.receiverBaseRub;
  }

  /**
   * Синхронизирует начисления мастеров с назначением: новым — ставка сразу, снятым — начисление удаляется.
   * Если машина уже закрыта, новое начисление сразу считается начисленным.
   */
  async syncMasters(visitId: number, added: number[], removed: number[]) {
    if (removed.length) {
      await this.prisma.payrollEntry.deleteMany({ where: { visitId, role: PayrollRole.MASTER, staffId: { in: removed } } });
    }
    if (!added.length) return;
    const [visit, staff, baseRub] = await Promise.all([
      this.prisma.visitHistory.findUnique({ where: { id: visitId }, select: { completedAt: true } }),
      this.prisma.staff.findMany({ where: { id: { in: added } }, select: { id: true, fullName: true } }),
      this.rateFor(PayrollRole.MASTER),
    ]);
    await this.prisma.payrollEntry.createMany({
      data: staff.map((s) => ({
        visitId,
        staffId: s.id,
        staffName: s.fullName,
        role: PayrollRole.MASTER,
        baseRub,
        accruedAt: visit?.completedAt ?? null,
      })),
      skipDuplicates: true,
    });
  }

  /** Назначить (или снять, `staffId = null`) мастера-приёмщика записи. Приёмщик — сотрудник с ролью ADMIN. */
  async setReceiver(visitId: number, staffId: number | null, req: Request) {
    const visit = await this.prisma.visitHistory.findUnique({
      where: { id: visitId },
      select: { id: true, receiverId: true, completedAt: true },
    });
    if (!visit) throw new NotFoundException("Запись не найдена");
    if (visit.receiverId === staffId) return this.forVisit(visitId);

    let fullName = "";
    if (staffId !== null) {
      const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { role: true, blockedAt: true, fullName: true } });
      if (!staff) throw new BadRequestException("Сотрудник не найден");
      if (staff.role !== StaffRole.ADMIN || staff.blockedAt) {
        throw new BadRequestException(`«${staff.fullName}» нельзя назначить приёмщиком: нужен активный администратор`);
      }
      fullName = staff.fullName;
    }
    const baseRub = staffId === null ? 0 : await this.rateFor(PayrollRole.RECEIVER);

    await this.prisma.$transaction([
      this.prisma.visitHistory.update({ where: { id: visitId }, data: { receiverId: staffId } }),
      this.prisma.payrollEntry.deleteMany({ where: { visitId, role: PayrollRole.RECEIVER } }),
      ...(staffId === null
        ? []
        : [
            this.prisma.payrollEntry.create({
              data: { visitId, staffId, staffName: fullName, role: PayrollRole.RECEIVER, baseRub, accruedAt: visit.completedAt },
            }),
          ]),
    ]);
    await this.audit.log({
      action: StaffAuditAction.VISIT_RECEIVER_CHANGED,
      actor: adminActor(req),
      req,
      meta: { visitId, from: visit.receiverId, to: staffId },
    });
    return this.forVisit(visitId);
  }

  /** Условия закрытия машины и их выполнение (для страницы записи и для `complete`). */
  async closingStatus(visitId: number) {
    const visit = await this.prisma.visitHistory.findUnique({
      where: { id: visitId },
      select: {
        diskLink: true,
        siteLead: { select: { diskLink: true } },
        photos: { select: { stage: true } },
        documents: { select: { kind: true, versions: { orderBy: { version: "desc" }, take: 1, select: { status: true } } } },
      },
    });
    if (!visit) throw new NotFoundException("Запись не найдена");
    return closingChecklist({
      photoStages: visit.photos.map((p) => p.stage),
      diskLink: visit.diskLink || visit.siteLead?.diskLink,
      signedKinds: visit.documents.filter((d) => d.versions[0]?.status === "SIGNED").map((d) => d.kind),
    });
  }

  /** Всё по зарплате записи: начисления с доп. выплатами, справочник выплат, приёмщик, условия закрытия. */
  async forVisit(visitId: number) {
    const visit = await this.prisma.visitHistory.findUnique({
      where: { id: visitId },
      select: { id: true, completedAt: true, receiverId: true, receiver: { select: { id: true, fullName: true } } },
    });
    if (!visit) throw new NotFoundException("Запись не найдена");
    const [entries, bonusTypes, closing] = await Promise.all([
      this.prisma.payrollEntry.findMany({ where: { visitId }, include: entryInclude, orderBy: [{ role: "desc" }, { id: "asc" }] }),
      this.prisma.payrollBonusType.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      this.closingStatus(visitId),
    ]);
    return {
      closed: !!visit.completedAt,
      receiver: visit.receiver,
      closing,
      bonusTypes,
      entries: entries.map((e) => ({
        id: e.id,
        staffId: e.staffId,
        staffName: e.staffName,
        role: e.role,
        baseRub: e.baseRub,
        accrued: !!e.accruedAt,
        bonuses: e.bonuses.map((b) => ({ id: b.id, typeId: b.typeId, title: b.title, amountRub: b.amountRub })),
        totalRub: entryTotal(e.baseRub, e.bonuses),
      })),
    };
  }

  /** Управляющий ставит/снимает доп. выплату. Только после закрытия машины и только подходящую по роли. */
  async setBonus(entryId: number, typeId: number, granted: boolean, req: Request) {
    const entry = await this.prisma.payrollEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException("Начисление не найдено");
    if (!entry.accruedAt) throw new ConflictException("Доп. выплаты ставятся после закрытия машины");
    const type = await this.prisma.payrollBonusType.findUnique({ where: { id: typeId } });
    if (!type) throw new NotFoundException("Тип выплаты не найден");
    if (type.role !== entry.role) throw new BadRequestException("Эта выплата не подходит для этой роли");

    if (granted) {
      if (!type.active) throw new BadRequestException("Тип выплаты отключён");
      await this.prisma.payrollBonus.upsert({
        where: { entryId_typeId: { entryId, typeId } },
        create: { entryId, typeId, title: type.title, amountRub: type.amountRub, grantedBy: adminActor(req) },
        update: {},
      });
    } else {
      await this.prisma.payrollBonus.deleteMany({ where: { entryId, typeId } });
    }
    await this.audit.log({
      action: StaffAuditAction.PAYROLL_BONUS_SET,
      actor: adminActor(req),
      req,
      meta: { entryId, visitId: entry.visitId, typeId, title: type.title, amountRub: type.amountRub, granted },
    });
    return this.forVisit(entry.visitId);
  }

  // --- Ведомость ---

  /** Ведомость за период (даты по Москве, включительно): по сотрудникам и по записям. Считаются только начисленные. */
  async report(q: PayrollReportQueryDto) {
    const from = mskDayStart(new Date(`${q.from}T12:00:00+03:00`));
    const to = new Date(mskDayStart(new Date(`${q.to}T12:00:00+03:00`)).getTime() + DAY_MS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new BadRequestException("Неверный период");
    if (to.getTime() - from.getTime() > 366 * DAY_MS) throw new BadRequestException("Период не больше года");

    const rows = await this.prisma.payrollEntry.findMany({
      where: {
        accruedAt: { gte: from, lt: to },
        ...(q.staffId ? { staffId: q.staffId } : {}),
        ...(q.location ? { visit: { location: q.location } } : {}),
      },
      include: {
        bonuses: true,
        visit: { select: { id: true, startsAt: true, visitDate: true, serviceType: true, location: true, docNumber: true } },
      },
      orderBy: [{ accruedAt: "asc" }, { id: "asc" }],
    });

    const byStaff = new Map<string, { staffId: number | null; staffName: string; baseRub: number; bonusRub: number; totalRub: number; orders: number }>();
    for (const r of rows) {
      const key = r.staffId !== null ? String(r.staffId) : `deleted:${r.staffName}`;
      const g = byStaff.get(key) ?? { staffId: r.staffId, staffName: r.staffName, baseRub: 0, bonusRub: 0, totalRub: 0, orders: 0 };
      const bonus = r.bonuses.reduce((s, b) => s + b.amountRub, 0);
      g.baseRub += r.baseRub;
      g.bonusRub += bonus;
      g.totalRub += r.baseRub + bonus;
      g.orders += 1;
      byStaff.set(key, g);
    }
    const staff = [...byStaff.values()].sort((a, b) => a.staffName.localeCompare(b.staffName, "ru"));
    return {
      from: q.from,
      to: q.to,
      totalRub: staff.reduce((s, g) => s + g.totalRub, 0),
      staff,
      entries: rows.map((r) => ({
        id: r.id,
        visitId: r.visitId,
        visitDate: r.visit.visitDate.toISOString().slice(0, 10),
        serviceType: r.visit.serviceType,
        location: r.visit.location,
        docNumber: r.visit.docNumber,
        staffId: r.staffId,
        staffName: r.staffName,
        role: r.role,
        baseRub: r.baseRub,
        bonuses: r.bonuses.map((b) => ({ title: b.title, amountRub: b.amountRub })),
        totalRub: entryTotal(r.baseRub, r.bonuses),
        accruedAt: r.accruedAt!.toISOString(),
      })),
    };
  }
}
