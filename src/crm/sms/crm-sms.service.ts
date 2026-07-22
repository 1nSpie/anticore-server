import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { SmsTemplateKind } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SmsService } from "../../cabinet/sms/sms.service";
import {
  formatClientFio,
  formatDateRu,
  formatTimeRu,
  renderSmsTemplate,
} from "../common/crm-format.util";

type VisitWithUser = {
  id: number;
  startsAt: Date | null;
  endsAt: Date | null;
  visitDate: Date;
  serviceType: string;
  priceRub: number | null;
  reviewSmsSentAt?: Date | null;
  user: {
    phone: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
    customCar: string | null;
    car?: { model: string; brand?: { name: string } | null } | null;
  };
};

@Injectable()
export class CrmSmsService {
  private readonly logger = new Logger(CrmSmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  async sendRaw(
    phone: string,
    message: string,
    kind: string,
    opts?: { clientIp?: string },
  ) {
    await this.sms.sendCode(phone, message, { clientIp: opts?.clientIp });
    await this.prisma.smsLog.create({
      data: { phone, kind, message },
    });
  }

  async sendAppointmentSms(visit: VisitWithUser) {
    const template = await this.prisma.smsTemplate.findUnique({
      where: { kind: SmsTemplateKind.APPOINTMENT },
    });
    if (!template) return;

    const company = await this.getCompanyName();
    const start = visit.startsAt ?? visit.visitDate;
    const message = renderSmsTemplate(template.body, {
      name: formatClientFio(visit.user),
      date: formatDateRu(start),
      time: formatTimeRu(start),
      service: visit.serviceType,
      price: String(visit.priceRub ?? 0),
      company,
    });

    await this.sendRaw(visit.user.phone, message.trim(), "appointment");
  }

  /**
   * SMS с запросом отзыва — только вручную менеджером.
   * Повторная отправка по той же записи запрещена.
   */
  async sendReviewSms(visit: VisitWithUser) {
    if (visit.reviewSmsSentAt) {
      throw new ConflictException(
        "SMS с запросом отзыва по этой записи уже отправлялось",
      );
    }

    const template = await this.prisma.smsTemplate.findUnique({
      where: { kind: SmsTemplateKind.REVIEW },
    });
    if (!template?.body?.trim()) {
      throw new BadRequestException(
        "Не задан шаблон SMS «Запрос отзыва» (раздел SMS в админке)",
      );
    }

    const company = await this.getCompanyName();
    const start = visit.startsAt ?? visit.visitDate;
    const message = renderSmsTemplate(template.body, {
      name: formatClientFio(visit.user),
      date: formatDateRu(start),
      time: formatTimeRu(start),
      service: visit.serviceType,
      price: String(visit.priceRub ?? 0),
      company,
    });

    await this.sendRaw(visit.user.phone, message.trim(), "review");
    await this.prisma.visitHistory.update({
      where: { id: visit.id },
      data: { reviewSmsSentAt: new Date() },
    });

    await this.prisma.pendingReviewSms
      .deleteMany({ where: { visitId: visit.id } })
      .catch(() => undefined);
  }

  async sendBirthdayGreetings() {
    const moscowNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }),
    );
    const month = moscowNow.getMonth() + 1;
    const day = moscowNow.getDate();
    const startOfDay = new Date(moscowNow);
    startOfDay.setHours(0, 0, 0, 0);

    const users = await this.prisma.cabinetUser.findMany({
      where: {
        birthDate: { not: null },
        blocked: false,
      },
      include: {
        car: { include: { brand: { select: { name: true } } } },
      },
    });

    const birthdayUsers = users.filter((u) => {
      if (!u.birthDate) return false;
      return (
        u.birthDate.getMonth() + 1 === month &&
        u.birthDate.getDate() === day
      );
    });

    const template = await this.prisma.smsTemplate.findUnique({
      where: { kind: SmsTemplateKind.BIRTHDAY },
    });
    if (!template) return;

    const company = await this.getCompanyName();
    const dayKey = formatDateRu(moscowNow);

    for (const user of birthdayUsers) {
      const already = await this.prisma.smsLog.findFirst({
        where: {
          phone: user.phone,
          kind: { startsWith: "birthday:" },
          sentAt: { gte: startOfDay },
        },
      });
      if (already) continue;

      const message = renderSmsTemplate(template.body, {
        name: formatClientFio(user),
        company,
      });

      try {
        await this.sendRaw(user.phone, message, `birthday:${dayKey}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`Birthday SMS ${user.phone}: ${msg}`);
      }
    }
  }

  private async getCompanyName() {
    const row = await this.prisma.companySettings.findUnique({
      where: { id: 1 },
    });
    return row?.companyName ?? "АванКор";
  }
}
