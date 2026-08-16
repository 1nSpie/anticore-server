import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CrmLocation, SmsTemplateKind } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CRM_LOCATION_LABELS,
  CRM_LOCATIONS,
} from "../common/crm-location";
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

  /** Лимиты записей на дни месяца для филиала. */
  async getDayLimits(year: number, month: number, location: string) {
    const loc = this.parseLocation(location);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Некорректный год");
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException("Некорректный месяц");
    }

    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const rows = await this.prisma.crmDayLimit.findMany({
      where: { date: { gte: from, lt: to }, location: loc },
      orderBy: { date: "asc" },
    });

    return rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      location: r.location,
      maxAppointments: r.maxAppointments,
      note: r.note,
    }));
  }

  async upsertDayLimits(dto: UpsertDayLimitsDto) {
    const location = this.parseLocation(dto.location);
    for (const item of dto.items) {
      const date = this.parseDateOnly(item.date);
      await this.prisma.crmDayLimit.upsert({
        where: { date_location: { date, location } },
        create: {
          date,
          location,
          maxAppointments: item.maxAppointments,
          note: item.note?.trim() || null,
        },
        update: {
          maxAppointments: item.maxAppointments,
          note: item.note?.trim() || null,
        },
      });
    }

    return { ok: true, count: dto.items.length, location };
  }

  async deleteDayLimit(dateStr: string, location: string) {
    const loc = this.parseLocation(location);
    const date = this.parseDateOnly(dateStr);
    await this.prisma.crmDayLimit.deleteMany({
      where: { date, location: loc },
    });
    return { message: "Лимит снят" };
  }

  /**
   * Если на день+филиал задан лимит — проверяем число записей этого филиала.
   * Без лимита ограничений нет.
   */
  async assertDayCapacity(
    startsAt: Date,
    opts: { location: string; excludeVisitId?: number },
  ) {
    const loc = this.parseLocation(opts.location);
    const day = this.moscowDateOnly(startsAt);
    const limit = await this.prisma.crmDayLimit.findUnique({
      where: { date_location: { date: day, location: loc } },
    });
    if (!limit) return;

    const dayEnd = new Date(day);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const count = await this.prisma.visitHistory.count({
      where: {
        startsAt: { gte: day, lt: dayEnd },
        location: loc,
        ...(opts.excludeVisitId ? { id: { not: opts.excludeVisitId } } : {}),
      },
    });

    if (count >= limit.maxAppointments) {
      const label = day.toISOString().slice(0, 10);
      const city = CRM_LOCATION_LABELS[loc];
      throw new BadRequestException(
        limit.maxAppointments === 0
          ? `${city}: на ${label} запись закрыта (лимит 0)`
          : `${city}: на ${label} достигнут лимит записей (${limit.maxAppointments})`,
      );
    }
  }

  private parseLocation(value: string): CrmLocation {
    if (!(CRM_LOCATIONS as readonly string[]).includes(value)) {
      throw new BadRequestException("Укажите филиал");
    }
    return value as CrmLocation;
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
