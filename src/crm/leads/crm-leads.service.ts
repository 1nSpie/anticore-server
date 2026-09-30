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
import {
  MSK_OFFSET_MS,
  mskDateAsUtcMidnight,
  mskDayBounds,
  workDayStartFor,
} from "../common/crm-work-hours";

/**
 * Дата повторной связи → 07:30 МСК указанного дня.
 * Принимает `YYYY-MM-DD` или любой ISO-момент (берётся его московская дата).
 */
export function normalizeFollowUpAt(raw: string): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return workDayStartFor(trimmed);
  const at = new Date(trimmed);
  if (Number.isNaN(at.getTime())) {
    throw new BadRequestException("Некорректная дата повторной связи");
  }
  const mskYmd = new Date(at.getTime() + MSK_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  return workDayStartFor(mskYmd);
}

/**
 * Варианты подстроки для поиска по телефону (хранится как `79XXXXXXXXX`).
 * «8 916 …» ищем и как «7916…»; «+7 (916) 123» → «7916123».
 */
export function leadPhoneSearchVariants(q?: string): string[] {
  const digits = (q ?? "").replace(/\D/g, "");
  if (!digits) return [];
  const variants = [digits];
  if (digits.length > 1 && digits.startsWith("8")) variants.push(`7${digits.slice(1)}`);
  return variants;
}

/** Статусы, которые ставит только система по записи в календаре. */
const VISIT_DRIVEN_STATUSES: SiteLeadStatus[] = [
  SiteLeadStatus.SCHEDULED,
  SiteLeadStatus.IN_PROGRESS,
];

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

  async list(status?: SiteLeadStatus, q?: string) {
    const phoneVariants = leadPhoneSearchVariants(q);
    return this.prisma.siteLead.findMany({
      where: {
        ...(status && { status }),
        ...(phoneVariants.length && {
          OR: phoneVariants.map((v) => ({ phone: { contains: v } })),
        }),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        visit: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            serviceType: true,
            completedAt: true,
          },
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

    if (
      dto.status !== undefined &&
      dto.status !== lead.status &&
      VISIT_DRIVEN_STATUSES.includes(dto.status as SiteLeadStatus) &&
      !lead.visitId
    ) {
      throw new BadRequestException(
        "Статусы «В календаре» и «В работе» ставятся автоматически после записи в календарь",
      );
    }

    if (
      dto.status === SiteLeadStatus.NEEDS_CLARIFICATION &&
      lead.status !== SiteLeadStatus.NEEDS_CLARIFICATION
    ) {
      const nextFollowUp =
        dto.followUpAt !== undefined ? dto.followUpAt : lead.followUpAt;
      if (!nextFollowUp) {
        throw new BadRequestException(
          "Для статуса «На уточнении» укажите дату, когда вернуться к заявке",
        );
      }
    }

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
        followUpAt: dto.followUpAt ? normalizeFollowUpAt(dto.followUpAt) : null,
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
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            serviceType: true,
            completedAt: true,
          },
        },
      },
    });

    if (lead.visitId) {
      const closing =
        dto.status === SiteLeadStatus.COMPLETED &&
        lead.status !== SiteLeadStatus.COMPLETED;
      const syncLink =
        diskLink !== undefined &&
        diskLink &&
        (dto.status === SiteLeadStatus.COMPLETED ||
          lead.status === SiteLeadStatus.COMPLETED);
      const reopening =
        dto.status !== undefined &&
        dto.status !== SiteLeadStatus.COMPLETED &&
        lead.status === SiteLeadStatus.COMPLETED;
      if (closing || syncLink || reopening) {
        // Закрытие заявки закрывает и её запись в календаре, возврат из «Выполнена» — открывает.
        await this.prisma.visitHistory.updateMany({
          where: { id: lead.visitId },
          data: {
            ...(syncLink && { diskLink }),
            ...(closing && { completedAt: new Date() }),
            ...(reopening && { completedAt: null }),
          },
        });
      }
      // «В календаре» ↔ «В работе» по дню записи — сразу, не дожидаясь cron.
      const synced = await this.syncVisitStatuses({ visitId: lead.visitId });
      if (synced.toInProgress || synced.toScheduled) return this.get(id);
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

    await this.prisma.siteLead.update({
      where: { id: leadId },
      data: {
        visitId,
        status: SiteLeadStatus.SCHEDULED,
        processedAt: new Date(),
        followUpAt: null,
      },
    });
    await this.syncVisitStatuses({ visitId });
    return this.get(leadId);
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

  /**
   * Наступил день повторной связи (07:30 МСК) → заявка снова «Новая»
   * и попадает под контроль 30 минут (отсчёт от `surfacedAt`).
   */
  async processDueFollowUps(now = new Date()): Promise<number> {
    const result = await this.prisma.siteLead.updateMany({
      where: {
        followUpAt: { lte: now },
        status: {
          in: [
            SiteLeadStatus.NEW,
            SiteLeadStatus.PROCESSING,
            SiteLeadStatus.NEEDS_CLARIFICATION,
          ],
        },
      },
      data: {
        status: SiteLeadStatus.NEW,
        surfacedAt: now,
        followUpAt: null,
      },
    });
    return result.count;
  }

  /**
   * Статус заявки по её записи в календаре:
   * день записи наступил (или прошёл), запись не закрыта → «В работе» (авто на подъёмнике);
   * запись в будущем → «В календаре».
   */
  async syncVisitStatuses(
    opts: { visitId?: number; now?: Date } = {},
  ): Promise<{ toInProgress: number; toScheduled: number }> {
    const now = opts.now ?? new Date();
    const { end: tomorrowStart } = mskDayBounds(now);
    const today = mskDateAsUtcMidnight(now);
    const byVisit = opts.visitId !== undefined ? { visitId: opts.visitId } : {};

    const dueToday = {
      OR: [
        { startsAt: { lt: tomorrowStart } },
        { startsAt: null, visitDate: { lte: today } },
      ],
    };

    const toInProgress = await this.prisma.siteLead.updateMany({
      where: {
        ...byVisit,
        status: SiteLeadStatus.SCHEDULED,
        visit: { is: { completedAt: null, ...dueToday } },
      },
      data: { status: SiteLeadStatus.IN_PROGRESS },
    });

    const toScheduled = await this.prisma.siteLead.updateMany({
      where: {
        ...byVisit,
        status: SiteLeadStatus.IN_PROGRESS,
        visit: {
          is: {
            completedAt: null,
            OR: [
              { startsAt: { gte: tomorrowStart } },
              { startsAt: null, visitDate: { gt: today } },
            ],
          },
        },
      },
      data: { status: SiteLeadStatus.SCHEDULED },
    });

    return { toInProgress: toInProgress.count, toScheduled: toScheduled.count };
  }
}
