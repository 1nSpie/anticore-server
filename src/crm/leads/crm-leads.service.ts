import {
  BadRequestException,
  ConflictException,
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

function assertAdminNoteOnLeaveNew(
  lead: { status: SiteLeadStatus; adminNote: string | null },
  dto: UpdateSiteLeadDto,
): void {
  const nextStatus = dto.status ?? lead.status;
  if (
    lead.status === SiteLeadStatus.NEW &&
    nextStatus !== SiteLeadStatus.NEW
  ) {
    const note = (dto.adminNote ?? lead.adminNote)?.trim();
    if (!note) {
      throw new BadRequestException(
        "Укажите комментарий администратора при смене статуса с «Новая»",
      );
    }
  }
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

    assertAdminNoteOnLeaveNew(lead, dto);

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
      ...(dto.followUpAt !== undefined && {
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : null,
      }),
      ...(dto.location !== undefined && { location: dto.location }),
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

  /** Бросает, если заявка уже в календаре / завершена / отклонена. */
  assertCanSchedule(lead: {
    id: number;
    status: SiteLeadStatus;
    visitId: number | null;
    adminNote: string | null;
  }): void {
    if (lead.visitId) {
      throw new ConflictException(
        `Заявка #${lead.id} уже записана в календарь (визит #${lead.visitId})`,
      );
    }
    if (lead.status === SiteLeadStatus.SCHEDULED) {
      throw new ConflictException(
        `Заявка #${lead.id} уже имеет статус «В календаре»`,
      );
    }
    if (
      lead.status === SiteLeadStatus.REJECTED ||
      lead.status === SiteLeadStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Заявку #${lead.id} нельзя записать в календарь из текущего статуса`,
      );
    }
    assertAdminNoteOnLeaveNew(lead, {
      status: SiteLeadStatus.SCHEDULED,
    });
  }

  async linkToVisit(leadId: number, visitId: number) {
    const lead = await this.get(leadId);
    this.assertCanSchedule(lead);

    const visit = await this.prisma.visitHistory.findUnique({
      where: { id: visitId },
      select: { id: true },
    });
    if (!visit) throw new NotFoundException("Запись в календаре не найдена");

    const taken = await this.prisma.siteLead.findFirst({
      where: { visitId },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException(
        `Запись #${visitId} уже привязана к заявке #${taken.id}`,
      );
    }

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

  /** Заявки с наступившей датой повторной связи → «На уточнении». */
  async processDueFollowUps(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.siteLead.updateMany({
      where: {
        followUpAt: { lte: now },
        status: {
          notIn: [
            SiteLeadStatus.REJECTED,
            SiteLeadStatus.COMPLETED,
            SiteLeadStatus.SCHEDULED,
          ],
        },
      },
      data: {
        status: SiteLeadStatus.NEEDS_CLARIFICATION,
        followUpAt: null,
      },
    });
    return result.count;
  }
}
