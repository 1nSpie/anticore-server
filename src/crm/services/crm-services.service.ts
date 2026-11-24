import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Request } from "express";
import type { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "../../staff/staff-audit.service";
import { agreedOnly, checkDiscount, computePricing } from "./pricing";
import { categoryInclude, toGroupDefs, type CategoryRow } from "./catalog.util";
import { itemTitle, parseSelections, type Selections } from "./services.rules";
import type { CreateWorkItemDto, UpdatePricingDto, UpdateWorkItemDto } from "./dto/services.dto";

/** Справочник услуг, перечень согласованных работ и стоимость записи (ТЗ §8.5, §9). */
@Injectable()
export class CrmServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
  ) {}

  // --- справочник ---------------------------------------------------------------------------

  async catalog(includeInactive = false) {
    const categories = await this.prisma.serviceCategory.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { sortOrder: "asc" },
      include: categoryInclude,
    });
    return categories.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      groups: c.groups.map((g) => ({
        id: g.id,
        key: g.key,
        label: g.label,
        multiple: g.multiple,
        allowCustom: g.allowCustom,
        options: g.options
          .filter((o) => includeInactive || o.active)
          .map((o) => ({ id: o.id, name: o.name, active: o.active })),
      })),
    }));
  }

  /** Новый вариант в справочнике; удалённый ранее (отключённый) с таким именем включается обратно. */
  async addOption(groupId: number, name: string, req: Request) {
    const text = name.trim();
    if (!text) throw new BadRequestException("Введите название");
    const group = await this.prisma.serviceOptionGroup.findUnique({
      where: { id: groupId },
      include: { options: true },
    });
    if (!group) throw new NotFoundException("Группа не найдена");
    const same = group.options.find((o) => o.name.toLowerCase() === text.toLowerCase());
    if (same?.active) throw new ConflictException("Такой вариант уже есть");
    const option = same
      ? await this.prisma.serviceOption.update({ where: { id: same.id }, data: { active: true } })
      : await this.prisma.serviceOption.create({
          data: { groupId, name: text, sortOrder: Math.max(0, ...group.options.map((o) => o.sortOrder)) + 1 },
        });
    await this.audit.log({
      action: StaffAuditAction.SERVICE_OPTION_CHANGED,
      actor: adminActor(req),
      req,
      meta: { groupId, optionId: option.id, name: option.name, change: "added" },
    });
    return { id: option.id, name: option.name, active: option.active };
  }

  async updateOption(optionId: number, dto: { name?: string; active?: boolean }, req: Request) {
    const option = await this.prisma.serviceOption.findUnique({ where: { id: optionId } });
    if (!option) throw new NotFoundException("Вариант не найден");
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) throw new BadRequestException("Введите название");
    const updated = await this.prisma.serviceOption.update({
      where: { id: optionId },
      data: { ...(name !== undefined && { name }), ...(dto.active !== undefined && { active: dto.active }) },
    });
    await this.audit.log({
      action: StaffAuditAction.SERVICE_OPTION_CHANGED,
      actor: adminActor(req),
      req,
      meta: { optionId, before: { name: option.name, active: option.active }, after: { name: updated.name, active: updated.active } },
    });
    return { id: updated.id, name: updated.name, active: updated.active };
  }

  // --- перечень работ -----------------------------------------------------------------------

  async listWorks(visitId: number) {
    const visit = await this.loadVisit(visitId);
    return this.present(visit, await this.hasSignedContract(visitId));
  }

  async addWork(visitId: number, dto: CreateWorkItemDto, req: Request) {
    await this.loadVisit(visitId);
    await this.assertChangeAllowed(visitId, dto.reason);
    const category = await this.requireCategory(dto.categoryId);
    const selections = parseSelections(dto.selections, toGroupDefs(category));
    const comment = dto.comment?.trim() || null;
    if (Object.keys(selections).length === 0 && !comment) {
      throw new BadRequestException("Выберите хотя бы один параметр или опишите работу в комментарии");
    }
    const last = await this.prisma.visitWorkItem.findFirst({ where: { visitId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const item = await this.prisma.visitWorkItem.create({
      data: {
        visitId,
        categoryId: category.id,
        selections: selections as unknown as Prisma.InputJsonValue,
        comment,
        priceRub: dto.priceRub ?? null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    await this.syncVisit(visitId);
    await this.logWork(req, visitId, item.id, "added", null, { category: category.name, selections, comment, priceRub: item.priceRub }, dto.reason);
    return this.listWorks(visitId);
  }

  async updateWork(visitId: number, itemId: number, dto: UpdateWorkItemDto, req: Request) {
    const visit = await this.loadVisit(visitId);
    const existing = agreedOnly(visit.workItems).find((i) => i.id === itemId);
    if (!existing) throw new NotFoundException("Позиция не найдена");
    await this.assertChangeAllowed(visitId, dto.reason);
    const category = await this.requireCategory(existing.categoryId, true);
    const selections =
      dto.selections !== undefined
        ? parseSelections(dto.selections, toGroupDefs(category))
        : (existing.selections as unknown as Selections);
    const comment = dto.comment !== undefined ? dto.comment?.trim() || null : existing.comment;
    if (Object.keys(selections).length === 0 && !comment) {
      throw new BadRequestException("Выберите хотя бы один параметр или опишите работу в комментарии");
    }
    const priceRub = dto.priceRub !== undefined ? dto.priceRub : existing.priceRub;
    await this.prisma.visitWorkItem.update({
      where: { id: itemId },
      data: { selections: selections as unknown as Prisma.InputJsonValue, comment, priceRub },
    });
    await this.syncVisit(visitId);
    await this.logWork(
      req, visitId, itemId, "changed",
      { selections: existing.selections, comment: existing.comment, priceRub: existing.priceRub },
      { selections, comment, priceRub },
      dto.reason,
    );
    return this.listWorks(visitId);
  }

  async deleteWork(visitId: number, itemId: number, reason: string | undefined, req: Request) {
    const visit = await this.loadVisit(visitId);
    const existing = agreedOnly(visit.workItems).find((i) => i.id === itemId);
    if (!existing) throw new NotFoundException("Позиция не найдена");
    await this.assertChangeAllowed(visitId, reason);
    await this.prisma.visitWorkItem.delete({ where: { id: itemId } });
    await this.syncVisit(visitId);
    await this.logWork(
      req, visitId, itemId, "deleted",
      { category: existing.category.name, selections: existing.selections, comment: existing.comment, priceRub: existing.priceRub },
      null, reason,
    );
    return this.listWorks(visitId);
  }

  // --- стоимость ----------------------------------------------------------------------------

  async updatePricing(visitId: number, dto: UpdatePricingDto, req: Request) {
    const visit = await this.loadVisit(visitId);
    const touchesDiscount = dto.discountPercent !== undefined || dto.discountRub !== undefined;
    checkDiscount(dto.discountPercent, dto.discountRub);
    if (touchesDiscount) await this.assertChangeAllowed(visitId, dto.reason);

    const data: Prisma.VisitHistoryUpdateInput = {};
    if (touchesDiscount) {
      // Задаётся одно из двух значений; второе считается при чтении
      data.discountPercent = dto.discountPercent ?? null;
      data.discountRub = dto.discountRub ?? null;
    }
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.paidRub !== undefined) data.paidRub = dto.paidRub;
    if (Object.keys(data).length === 0) return this.listWorks(visitId);

    await this.prisma.visitHistory.update({ where: { id: visitId }, data });
    await this.audit.log({
      action: StaffAuditAction.PRICING_CHANGED,
      actor: adminActor(req),
      req,
      meta: {
        visitId,
        before: { discountPercent: visit.discountPercent, discountRub: visit.discountRub, paymentMethod: visit.paymentMethod, paidRub: visit.paidRub },
        after: JSON.parse(JSON.stringify(data)),
        ...(dto.reason && { reason: dto.reason }),
      },
    });
    return this.listWorks(visitId);
  }

  // ---------------------------------------------------------------------------------------------

  /** Согласованные работы — источник правды: цена и название услуги записи пересчитываются из перечня. */
  private async syncVisit(visitId: number) {
    const visit = await this.loadVisit(visitId);
    const agreed = agreedOnly(visit.workItems);
    if (agreed.length === 0) return;
    const pricing = this.pricingOf(visit);
    const names = [...new Set(agreed.map((i) => i.category.name))].join("; ");
    await this.prisma.visitHistory.update({
      where: { id: visitId },
      data: {
        serviceType: names.slice(0, 300),
        ...(pricing.preliminary != null && { priceRub: pricing.preliminary }),
      },
    });
  }

  private pricingOf(visit: Awaited<ReturnType<CrmServicesService["loadVisit"]>>) {
    return computePricing({
      items: agreedOnly(visit.workItems),
      fallbackPriceRub: visit.priceRub,
      discountPercent: visit.discountPercent,
      discountRub: visit.discountRub,
      paidRub: visit.paidRub,
    });
  }

  private present(visit: Awaited<ReturnType<CrmServicesService["loadVisit"]>>, signed: boolean) {
    return {
      visitId: visit.id,
      items: agreedOnly(visit.workItems).map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        categoryName: i.category.name,
        selections: i.selections as unknown as Selections,
        comment: i.comment,
        priceRub: i.priceRub,
        title: itemTitle(i.category, i.selections as unknown as Selections),
      })),
      pricing: this.pricingOf(visit),
      paymentMethod: visit.paymentMethod,
      /** Договор подписан: любое изменение требует указать, как оно согласовано. */
      contractSigned: signed,
    };
  }

  private async loadVisit(visitId: number) {
    const visit = await this.prisma.visitHistory.findUnique({
      where: { id: visitId },
      include: { workItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { category: { include: { groups: true } } } } },
    });
    if (!visit) throw new NotFoundException("Запись не найдена");
    return visit;
  }

  private async requireCategory(id: number, allowInactive = false): Promise<CategoryRow> {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id }, include: categoryInclude });
    if (!category || (!allowInactive && !category.active)) throw new BadRequestException("Категория услуг не найдена");
    return category;
  }

  private hasSignedContract(visitId: number) {
    return this.prisma.documentVersion
      .findFirst({ where: { status: "SIGNED", document: { visitId, kind: "CONTRACT" } }, select: { id: true } })
      .then((v) => v !== null);
  }

  /** После подписания договора меняют перечень и цену только с указанием, как это согласовано (ТЗ §9.6, §18). */
  private async assertChangeAllowed(visitId: number, reason: string | undefined) {
    if (await this.hasSignedContract(visitId)) {
      if (!reason || reason.trim().length < 3) {
        throw new BadRequestException("Договор подписан: укажите, как клиент согласовал изменение");
      }
    }
  }

  private logWork(
    req: Request, visitId: number, itemId: number, change: string,
    before: unknown, after: unknown, reason: string | undefined,
  ) {
    return this.audit.log({
      action: StaffAuditAction.WORK_ITEM_CHANGED,
      actor: adminActor(req),
      req,
      meta: JSON.parse(JSON.stringify({ visitId, itemId, change, before, after, ...(reason && { reason }) })),
    });
  }
}
