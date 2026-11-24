import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "../../staff/staff-audit.service";
import { mskDateAsUtcMidnight } from "../common/crm-work-hours";
import { CashQueryDto, CreateCashEntryDto } from "./dto/cash.dto";
import { LOCATION_LABELS, cashTotals, toCsv } from "./cash.rules";

const DAY_MS = 86_400_000;

/** Табель прихода и расхода наличных по филиалам. */
@Injectable()
export class CrmCashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
  ) {}

  private range(q: CashQueryDto) {
    const from = new Date(`${q.from}T00:00:00Z`);
    const to = new Date(`${q.to}T00:00:00Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) throw new BadRequestException("Неверный период");
    if (to.getTime() - from.getTime() > 366 * DAY_MS) throw new BadRequestException("Период не больше года");
    return { from, to };
  }

  async list(q: CashQueryDto) {
    const { from, to } = this.range(q);
    const where = { date: { gte: from, lte: to }, ...(q.location ? { location: q.location } : {}) };
    const [rows, openingRows] = await Promise.all([
      this.prisma.cashEntry.findMany({ where, orderBy: [{ date: "asc" }, { id: "asc" }] }),
      // Остаток на начало периода: всё, что было до него
      this.prisma.cashEntry.findMany({
        where: { date: { lt: from }, voidedAt: null, ...(q.location ? { location: q.location } : {}) },
        select: { direction: true, amountRub: true, voidedAt: true },
      }),
    ]);
    const openingRub = cashTotals(openingRows).balanceRub;
    const totals = cashTotals(rows);
    return {
      from: q.from,
      to: q.to,
      openingRub,
      ...totals,
      closingRub: openingRub + totals.balanceRub,
      entries: rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        location: r.location,
        direction: r.direction,
        amountRub: r.amountRub,
        category: r.category,
        comment: r.comment,
        visitId: r.visitId,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
        voided: !!r.voidedAt,
        voidReason: r.voidReason,
        voidedBy: r.voidedBy,
      })),
    };
  }

  async csv(q: CashQueryDto) {
    const data = await this.list(q);
    return toCsv(
      ["Дата", "Филиал", "Операция", "Сумма, ₽", "Статья", "Комментарий", "Запись", "Кто внёс", "Аннулирована"],
      data.entries.map((e) => [
        e.date,
        LOCATION_LABELS[e.location] ?? e.location,
        e.direction === "IN" ? "Приход" : "Расход",
        e.amountRub,
        e.category ?? "",
        e.comment ?? "",
        e.visitId ?? "",
        e.createdBy,
        e.voided ? `да: ${e.voidReason ?? ""}` : "",
      ]),
    );
  }

  async create(dto: CreateCashEntryDto, req: Request) {
    const today = mskDateAsUtcMidnight(new Date());
    const date = dto.date ? new Date(`${dto.date}T00:00:00Z`) : today;
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Неверная дата");
    if (date.getTime() > today.getTime()) throw new BadRequestException("Дата операции не может быть в будущем");
    if (dto.visitId) {
      const visit = await this.prisma.visitHistory.findUnique({ where: { id: dto.visitId }, select: { id: true } });
      if (!visit) throw new BadRequestException("Запись не найдена");
    }
    const row = await this.prisma.cashEntry.create({
      data: {
        location: dto.location,
        direction: dto.direction,
        amountRub: dto.amountRub,
        date,
        category: dto.category,
        comment: dto.comment,
        visitId: dto.visitId,
        createdBy: adminActor(req),
      },
    });
    await this.audit.log({
      action: StaffAuditAction.CASH_ENTRY_ADDED,
      actor: adminActor(req),
      req,
      meta: { id: row.id, location: row.location, direction: row.direction, amountRub: row.amountRub },
    });
    return row;
  }

  /** Операция не удаляется — аннулируется с причиной, в итогах не участвует. */
  async voidEntry(id: number, reason: string, req: Request) {
    const row = await this.prisma.cashEntry.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Операция не найдена");
    if (row.voidedAt) throw new ConflictException("Операция уже аннулирована");
    await this.prisma.cashEntry.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: adminActor(req), voidReason: reason } });
    await this.audit.log({ action: StaffAuditAction.CASH_ENTRY_VOIDED, actor: adminActor(req), req, meta: { id, reason, amountRub: row.amountRub } });
    return { message: "Операция аннулирована" };
  }
}
