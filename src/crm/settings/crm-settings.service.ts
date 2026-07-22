import { Injectable, NotFoundException } from "@nestjs/common";
import { SmsTemplateKind } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
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
}
