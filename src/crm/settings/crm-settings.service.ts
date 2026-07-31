import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SmsTemplateKind } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  UpsertDayLimitsDto,
  UpdateServiceTypesDto,
  UpdateSmsTemplatesDto,
} from "./dto/crm-settings.dto";

@Injectable()
export class CrmSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getServiceTypes() {
    return this.prisma.serviceType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async updateServiceTypes(dto: UpdateServiceTypesDto) {
    const results: Awaited<
      ReturnType<typeof this.prisma.serviceType.findMany>
    > = [];

    for (const item of dto.items) {
      if (item.id && item.id > 0) {
        results.push(
          await this.prisma.serviceType.update({
            where: { id: item.id },
            data: {
              name: item.name,
              sortOrder: item.sortOrder ?? 0,
              active: item.active ?? true,
            },
          }),
        );
      } else {
        results.push(
          await this.prisma.serviceType.create({
            data: {
              name: item.name,
              sortOrder: item.sortOrder ?? 0,
              active: item.active ?? true,
            },
          }),
        );
      }
    }

    return results;
  }

  async deleteServiceType(id: number) {
    const existing = await this.prisma.serviceType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Услуга не найдена");
    await this.prisma.serviceType.delete({ where: { id } });
    return { message: "Удалено" };
  }

  async getSmsTemplates() {
    const rows = await this.prisma.smsTemplate.findMany();
    const company = await this.getCompanyName();
    return {
      companyName: company,
      templates: {
        appointment:
          rows.find((r) => r.kind === SmsTemplateKind.APPOINTMENT)?.body ?? "",
        review: rows.find((r) => r.kind === SmsTemplateKind.REVIEW)?.body ?? "",
        birthday:
          rows.find((r) => r.kind === SmsTemplateKind.BIRTHDAY)?.body ?? "",
      },
    };
  }

  async updateSmsTemplates(dto: UpdateSmsTemplatesDto) {
    if (dto.companyName !== undefined) {
      const name = dto.companyName.trim() || "АванКор";
      await this.prisma.companySettings.upsert({
        where: { id: 1 },
        create: { id: 1, companyName: name },
        update: { companyName: name },
      });
    }

    await Promise.all([
      this.prisma.smsTemplate.upsert({
        where: { kind: SmsTemplateKind.APPOINTMENT },
        create: { kind: SmsTemplateKind.APPOINTMENT, body: dto.appointment },
        update: { body: dto.appointment },
      }),
      this.prisma.smsTemplate.upsert({
        where: { kind: SmsTemplateKind.REVIEW },
        create: { kind: SmsTemplateKind.REVIEW, body: dto.review },
        update: { body: dto.review },
      }),
      this.prisma.smsTemplate.upsert({
        where: { kind: SmsTemplateKind.BIRTHDAY },
        create: { kind: SmsTemplateKind.BIRTHDAY, body: dto.birthday },
        update: { body: dto.birthday },
      }),
    ]);
    return this.getSmsTemplates();
  }

  async getCompanyName() {
    const row = await this.prisma.companySettings.findUnique({ where: { id: 1 } });
    return row?.companyName ?? "АванКор";
  }

  /** Лимиты записей на дни месяца (календарные даты YYYY-MM-DD). */
  async getDayLimits(year: number, month: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Некорректный год");
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException("Некорректный месяц");
    }

    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const rows = await this.prisma.crmDayLimit.findMany({
      where: { date: { gte: from, lt: to } },
      orderBy: { date: "asc" },
    });

    return rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      maxAppointments: r.maxAppointments,
      note: r.note,
    }));
  }

  async upsertDayLimits(dto: UpsertDayLimitsDto) {
    for (const item of dto.items) {
      const date = this.parseDateOnly(item.date);
      await this.prisma.crmDayLimit.upsert({
        where: { date },
        create: {
          date,
          maxAppointments: item.maxAppointments,
          note: item.note?.trim() || null,
        },
        update: {
          maxAppointments: item.maxAppointments,
          note: item.note?.trim() || null,
        },
      });
    }

    return { ok: true, count: dto.items.length };
  }

  async deleteDayLimit(dateStr: string) {
    const date = this.parseDateOnly(dateStr);
    await this.prisma.crmDayLimit.deleteMany({ where: { date } });
    return { message: "Лимит снят" };
  }

  /**
   * Если на день задан лимит — проверяем число записей.
   * Без лимита ограничений нет.
   */
  async assertDayCapacity(
    startsAt: Date,
    opts?: { excludeVisitId?: number; location?: string },
  ) {
    const day = this.moscowDateOnly(startsAt);
    const limit = await this.prisma.crmDayLimit.findUnique({
      where: { date: day },
    });
    if (!limit) return;

    const dayEnd = new Date(day);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const count = await this.prisma.visitHistory.count({
      where: {
        startsAt: { gte: day, lt: dayEnd },
        ...(opts?.location
          ? { location: opts.location as never }
          : {}),
        ...(opts?.excludeVisitId ? { id: { not: opts.excludeVisitId } } : {}),
      },
    });

    if (count >= limit.maxAppointments) {
      const label = day.toISOString().slice(0, 10);
      throw new BadRequestException(
        limit.maxAppointments === 0
          ? `На ${label} запись закрыта (лимит 0)`
          : `На ${label} достигнут лимит записей (${limit.maxAppointments})`,
      );
    }
  }

  private parseDateOnly(value: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) throw new BadRequestException("Дата должна быть в формате YYYY-MM-DD");
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  private moscowDateOnly(value: Date): Date {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    const mo = Number(parts.find((p) => p.type === "month")?.value);
    const d = Number(parts.find((p) => p.type === "day")?.value);
    return new Date(Date.UTC(y, mo - 1, d));
  }
}
