import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Request } from "express";
import { CrmLocation, StockMoveKind } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "../../staff/staff-audit.service";
import { CreateStockItemDto, CreateStockMovementDto, MovementsQueryDto, UpdateStockItemDto } from "./dto/stock.dto";
import { isLow, movementDelta, wouldGoNegative } from "./stock.rules";

const LOCATIONS = Object.values(CrmLocation);

/** Склад: номенклатура, приход/расход/инвентаризация по филиалам, остатки. */
@Injectable()
export class CrmStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
  ) {}

  /** Остаток по позиции в каждом филиале: сумма движений. */
  private async balances(itemIds?: number[]) {
    const grouped = await this.prisma.stockMovement.groupBy({
      by: ["itemId", "location"],
      where: itemIds ? { itemId: { in: itemIds } } : undefined,
      _sum: { delta: true },
    });
    const map = new Map<string, number>();
    for (const g of grouped) map.set(`${g.itemId}:${g.location}`, Number(g._sum.delta ?? 0));
    return map;
  }

  /** Номенклатура с остатками по филиалам (или по одному) и признаком «ниже минимума». */
  async items(location?: CrmLocation) {
    const [items, map] = await Promise.all([
      this.prisma.stockItem.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
      this.balances(),
    ]);
    return items.map((i) => {
      const minQty = Number(i.minQty);
      const byLocation = Object.fromEntries(LOCATIONS.map((l) => [l, map.get(`${i.id}:${l}`) ?? 0]));
      const qty = location ? byLocation[location] : Object.values(byLocation).reduce((a, b) => a + b, 0);
      return { id: i.id, name: i.name, unit: i.unit, minQty, active: i.active, qty, byLocation, low: i.active && isLow(qty, minQty) };
    });
  }

  async createItem(dto: CreateStockItemDto, req: Request) {
    if (await this.prisma.stockItem.findUnique({ where: { name: dto.name } })) throw new ConflictException("Такая позиция уже есть");
    const row = await this.prisma.stockItem.create({ data: { name: dto.name, unit: dto.unit, minQty: dto.minQty ?? 0 } });
    await this.audit.log({ action: StaffAuditAction.STOCK_ITEM_CHANGED, actor: adminActor(req), req, meta: { id: row.id, created: dto.name } });
    return row;
  }

  async updateItem(id: number, dto: UpdateStockItemDto, req: Request) {
    const item = await this.prisma.stockItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Позиция не найдена");
    if (dto.name && dto.name !== item.name && (await this.prisma.stockItem.findUnique({ where: { name: dto.name } }))) {
      throw new ConflictException("Такая позиция уже есть");
    }
    const row = await this.prisma.stockItem.update({ where: { id }, data: { ...dto } });
    await this.audit.log({ action: StaffAuditAction.STOCK_ITEM_CHANGED, actor: adminActor(req), req, meta: { id, changes: { ...dto } } });
    return row;
  }

  async movements(q: MovementsQueryDto) {
    const rows = await this.prisma.stockMovement.findMany({
      where: {
        ...(q.location ? { location: q.location } : {}),
        ...(q.itemId ? { itemId: q.itemId } : {}),
        ...(q.visitId ? { visitId: q.visitId } : {}),
      },
      include: { item: { select: { name: true, unit: true } } },
      orderBy: { id: "desc" },
      take: q.limit ?? 100,
    });
    return rows.map((m) => ({
      id: m.id,
      itemId: m.itemId,
      itemName: m.item.name,
      unit: m.item.unit,
      location: m.location,
      kind: m.kind,
      delta: Number(m.delta),
      comment: m.comment,
      visitId: m.visitId,
      createdBy: m.createdBy,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Проводка движения. Расход выше остатка запрещён; инвентаризация задаёт новый остаток. */
  async move(dto: CreateStockMovementDto, req: Request) {
    const item = await this.prisma.stockItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException("Позиция не найдена");
    if (!item.active) throw new BadRequestException("Позиция отключена");
    if (dto.kind !== StockMoveKind.ADJUST && dto.qty <= 0) throw new BadRequestException("Количество должно быть больше нуля");
    if (dto.visitId) {
      const visit = await this.prisma.visitHistory.findUnique({ where: { id: dto.visitId }, select: { id: true } });
      if (!visit) throw new BadRequestException("Запись не найдена");
    }

    // Остаток читаем и пишем в одной транзакции, чтобы два расхода подряд не увели склад в минус
    const row = await this.prisma.$transaction(async (tx) => {
      const sum = await tx.stockMovement.aggregate({ where: { itemId: dto.itemId, location: dto.location }, _sum: { delta: true } });
      const current = Number(sum._sum.delta ?? 0);
      const delta = movementDelta(dto.kind, dto.qty, current);
      if (delta === 0) throw new BadRequestException("Остаток не изменится");
      if (wouldGoNegative(current, delta)) {
        throw new BadRequestException(`Не хватает на складе: остаток ${current} ${item.unit}, расход ${-delta} ${item.unit}`);
      }
      return tx.stockMovement.create({
        data: {
          itemId: dto.itemId,
          location: dto.location,
          kind: dto.kind,
          delta,
          comment: dto.comment,
          visitId: dto.visitId,
          createdBy: adminActor(req),
        },
      });
    });
    await this.audit.log({
      action: StaffAuditAction.STOCK_MOVED,
      actor: adminActor(req),
      req,
      meta: { id: row.id, itemId: dto.itemId, location: dto.location, kind: dto.kind, delta: Number(row.delta) },
    });
    return { ...row, delta: Number(row.delta) };
  }
}
