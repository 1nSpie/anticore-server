import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SiteLeadKind, SiteLeadStatus } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizePhoneRu } from "../../cabinet/common/phone.util";
import { UpdateSiteLeadDto } from "./dto/site-lead.dto";

export type SiteFormPayload = {
  name: string;
  phone: string;
  message?: string;
  carDescription?: string;
  communicationMethod?: string;
  href?: string;
};

function isTerminalStatus(status: SiteLeadStatus): boolean {
  return (
    status === SiteLeadStatus.SCHEDULED ||
    status === SiteLeadStatus.REJECTED ||
    status === SiteLeadStatus.COMPLETED
  );
}

@Injectable()
export class CrmLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromSiteForm(data: SiteFormPayload) {
    const phone = normalizePhoneRu(data.phone);

    const kind = data.carDescription?.trim()
      ? SiteLeadKind.PRICE_REQUEST
      : SiteLeadKind.CALLBACK;

    return this.prisma.siteLead.create({
      data: {
        kind,
        name: data.name.trim(),
        phone,
        message: data.message?.trim() || null,
        carDescription: data.carDescription?.trim() || null,
        communicationMethod: data.communicationMethod?.trim() || null,
        pageUrl: data.href?.trim() || null,
      },
    });
  }

  async list(status?: SiteLeadStatus) {
    return this.prisma.siteLead.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        visit: {
          select: { id: true, startsAt: true, endsAt: true, serviceType: true },
        },
      },
    });
  }

  async get(id: number) {
    const lead = await this.prisma.siteLead.findUnique({
      where: { id },
      include: { visit: true },
    });
    if (!lead) throw new NotFoundException("Заявка не найдена");
    return lead;
  }

  async update(id: number, dto: UpdateSiteLeadDto) {
    const lead = await this.get(id);

    if (dto.status === SiteLeadStatus.COMPLETED) {
      const link = (dto.diskLink ?? lead.diskLink)?.trim();
      if (!link) {
        throw new BadRequestException("Укажите ссылку на Яндекс.Диск");
      }
    }

    const diskLink =
      dto.diskLink !== undefined ? dto.diskLink?.trim() || null : undefined;

    const data: Parameters<typeof this.prisma.siteLead.update>[0]["data"] = {
      ...(dto.status !== undefined && {
        status: dto.status,
        processedAt: isTerminalStatus(dto.status) ? new Date() : undefined,
      }),
      ...(dto.adminNote !== undefined && { adminNote: dto.adminNote }),
      ...(dto.visitId !== undefined && { visitId: dto.visitId }),
      ...(diskLink !== undefined && { diskLink }),
    };

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 2) {
        throw new BadRequestException("Укажите имя клиента");
      }
      data.name = name;
    }

    if (dto.phone !== undefined) {
      data.phone = normalizePhoneRu(dto.phone);
    }

    if (dto.message !== undefined) {
      data.message = dto.message?.trim() || null;
    }

    if (dto.carDescription !== undefined) {
      data.carDescription = dto.carDescription?.trim() || null;
      if (dto.kind === undefined) {
        data.kind = dto.carDescription?.trim()
          ? SiteLeadKind.PRICE_REQUEST
          : SiteLeadKind.CALLBACK;
      }
    }

    if (dto.communicationMethod !== undefined) {
      data.communicationMethod = dto.communicationMethod?.trim() || null;
    }

    if (dto.kind !== undefined) {
      data.kind = dto.kind as SiteLeadKind;
    }

    const updated = await this.prisma.siteLead.update({
      where: { id },
      data,
      include: {
        visit: {
          select: { id: true, startsAt: true, endsAt: true, serviceType: true },
        },
      },
    });

    if (
      diskLink !== undefined &&
      diskLink &&
      lead.visitId &&
      (dto.status === SiteLeadStatus.COMPLETED ||
        lead.status === SiteLeadStatus.COMPLETED)
    ) {
      await this.prisma.visitHistory.update({
        where: { id: lead.visitId },
        data: { diskLink },
      });
    }

    return updated;
  }

  async linkToVisit(leadId: number, visitId: number) {
    await this.get(leadId);
    return this.prisma.siteLead.update({
      where: { id: leadId },
      data: {
        visitId,
        status: SiteLeadStatus.SCHEDULED,
        processedAt: new Date(),
      },
    });
  }

  async listForUserPhone(phone: string) {
    return this.prisma.siteLead.findMany({
      where: { phone },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        status: true,
        message: true,
        carDescription: true,
        createdAt: true,
        processedAt: true,
        diskLink: true,
      },
    });
  }
}
