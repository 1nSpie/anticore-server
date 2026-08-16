import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CrmLocation, SiteLeadStatus } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ClientVehiclesService } from "../../client-vehicles/client-vehicles.service";
import { CrmLeadsService } from "../leads/crm-leads.service";
import {
  DEFAULT_CRM_LOCATION,
  CRM_LOCATIONS,
  type CrmLocationCode,
} from "../common/crm-location";
import { formatVehicleLabel } from "../common/crm-format.util";
import { CrmSettingsService } from "../settings/crm-settings.service";
import { CrmSmsService } from "../sms/crm-sms.service";
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from "./dto/appointment.dto";

const appointmentInclude = {
  user: {
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
      patronymic: true,
      customCar: true,
      vin: true,
      car: { include: { brand: { select: { name: true } } } },
    },
  },
  vehicle: {
    include: {
      car: {
        select: {
          model: true,
          brand: { select: { name: true } },
        },
      },
    },
  },
  catalogServiceType: true,
} as const;

@Injectable()
export class CrmAppointmentsService {
  private readonly logger = new Logger(CrmAppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmSms: CrmSmsService,
    private readonly leads: CrmLeadsService,
    private readonly settings: CrmSettingsService,
    private readonly vehicles: ClientVehiclesService,
  ) {}

  async list(from?: string, to?: string, location?: string) {
    const where: {
      startsAt?: { gte?: Date; lte?: Date };
      location?: CrmLocation;
    } = {};
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = new Date(from);
      if (to) where.startsAt.lte = new Date(to);
    }
    if (location && (CRM_LOCATIONS as readonly string[]).includes(location)) {
      where.location = location as CrmLocation;
    }

    const rows = await this.prisma.visitHistory.findMany({
      where,
      orderBy: { startsAt: "asc" },
      include: appointmentInclude,
    });

    return rows.map((r) => this.toEvent(r));
  }

  async create(dto: CreateAppointmentDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertRange(startsAt, endsAt);

    await this.ensureClient(dto.clientId);
    const vehicleId = await this.resolveVehicleId(dto.clientId, dto.vehicleId);

    const location = (dto.location ?? DEFAULT_CRM_LOCATION) as CrmLocation;
    await this.settings.assertDayCapacity(startsAt, {
      location: location as CrmLocationCode,
    });

    if (dto.leadId) {
      const lead = await this.leads.get(dto.leadId);
      this.leads.assertCanSchedule(lead);
    }

    const visitData = {
      userId: dto.clientId,
      vehicleId,
      visitDate: startsAt,
      startsAt,
      endsAt,
      serviceType: dto.serviceType,
      serviceTypeId: dto.serviceTypeId ?? null,
      priceRub: dto.priceRub,
      managerName: dto.managerName?.trim() || null,
      location,
    };

    const row = dto.leadId
      ? await this.prisma.$transaction(async (tx) => {
          const visit = await tx.visitHistory.create({
            data: visitData,
          });

          const linked = await tx.siteLead.updateMany({
            where: {
              id: dto.leadId,
              visitId: null,
              status: {
                notIn: [
                  SiteLeadStatus.SCHEDULED,
                  SiteLeadStatus.REJECTED,
                  SiteLeadStatus.COMPLETED,
                ],
              },
            },
            data: {
              visitId: visit.id,
              status: SiteLeadStatus.SCHEDULED,
              processedAt: new Date(),
            },
          });

          if (linked.count === 0) {
            throw new ConflictException(
              `Заявка #${dto.leadId} уже записана в календарь или недоступна`,
            );
          }

          return tx.visitHistory.findUniqueOrThrow({
            where: { id: visit.id },
            include: appointmentInclude,
          });
        })
      : await this.prisma.visitHistory.create({
          data: visitData,
          include: appointmentInclude,
        });

    let smsError: string | null = null;
    try {
      await this.crmSms.sendAppointmentSms(row);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось отправить SMS";
      this.logger.warn(`SMS при создании записи #${row.id}: ${message}`);
      smsError =
        "Запись создана, но SMS клиенту не отправлено. Проверьте SMS.ru или отправьте вручную.";
    }

    return { ...this.toEvent(row), smsError };
  }

  async update(id: number, dto: UpdateAppointmentDto) {
    const existing = await this.prisma.visitHistory.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException("Запись не найдена");

    const clientId = dto.clientId ?? existing.userId;
    if (dto.clientId) await this.ensureClient(dto.clientId);

    let vehicleId = existing.vehicleId;
    if (dto.vehicleId !== undefined) {
      if (dto.vehicleId === null) {
        vehicleId = null;
      } else {
        await this.vehicles.assertOwnedActive(clientId, dto.vehicleId);
        vehicleId = dto.vehicleId;
      }
    } else if (dto.clientId && dto.clientId !== existing.userId) {
      vehicleId = await this.resolveVehicleId(clientId, undefined);
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    if (startsAt && endsAt) this.assertRange(startsAt, endsAt);
    const nextLocation = (dto.location ?? existing.location) as CrmLocation;
    if (startsAt) {
      await this.settings.assertDayCapacity(startsAt, {
        excludeVisitId: id,
        location: nextLocation as CrmLocationCode,
      });
    }

    const row = await this.prisma.visitHistory.update({
      where: { id },
      data: {
        ...(dto.clientId !== undefined && { userId: dto.clientId }),
        vehicleId,
        ...(dto.startsAt !== undefined && {
          startsAt,
          visitDate: startsAt!,
        }),
        ...(dto.endsAt !== undefined && { endsAt }),
        ...(dto.serviceType !== undefined && { serviceType: dto.serviceType }),
        ...(dto.serviceTypeId !== undefined && {
          serviceTypeId: dto.serviceTypeId,
        }),
        ...(dto.priceRub !== undefined && { priceRub: dto.priceRub }),
        ...(dto.managerName !== undefined && {
          managerName: dto.managerName?.trim() || null,
        }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.diskLink !== undefined && {
          diskLink: dto.diskLink?.trim() || null,
        }),
      },
      include: appointmentInclude,
    });

    return this.toEvent(row);
  }

  async remove(id: number) {
    const existing = await this.prisma.visitHistory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Запись не найдена");
    await this.prisma.visitHistory.delete({ where: { id } });
    return { message: "Удалено" };
  }

  /** Ручная отправка SMS с запросом отзыва (один раз на запись). */
  async sendReviewSms(id: number) {
    const visit = await this.prisma.visitHistory.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            car: { include: { brand: { select: { name: true } } } },
          },
        },
        vehicle: {
          include: {
            car: {
              select: { model: true, brand: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!visit) throw new NotFoundException("Запись не найдена");

    await this.crmSms.sendReviewSms(visit);

    const updated = await this.prisma.visitHistory.findUnique({
      where: { id },
      include: appointmentInclude,
    });
    return this.toEvent(updated!);
  }

  private assertRange(startsAt: Date, endsAt: Date) {
    if (endsAt <= startsAt) {
      throw new BadRequestException("Время окончания должно быть позже начала");
    }
  }

  private async ensureClient(id: number) {
    const u = await this.prisma.cabinetUser.findUnique({ where: { id } });
    if (!u) throw new NotFoundException("Клиент не найден");
  }

  /** If client has vehicles, vehicleId is required (or defaults to primary). */
  private async resolveVehicleId(
    clientId: number,
    vehicleId?: number,
  ): Promise<number | null> {
    if (vehicleId != null) {
      await this.vehicles.assertOwnedActive(clientId, vehicleId);
      return vehicleId;
    }

    const list = await this.vehicles.listForUser(clientId);
    if (list.length === 0) return null;
    const primary = list.find((v) => v.isPrimary) ?? list[0];
    return primary.id;
  }

  private toEvent(row: {
    id: number;
    userId: number;
    vehicleId?: number | null;
    startsAt: Date | null;
    endsAt: Date | null;
    visitDate: Date;
    serviceType: string;
    priceRub: number | null;
    serviceTypeId: number | null;
    managerName: string | null;
    location?: CrmLocation | null;
    reviewSmsSentAt?: Date | null;
    user: {
      id: number;
      phone: string;
      firstName: string | null;
      lastName: string | null;
      patronymic: string | null;
      customCar: string | null;
      vin: string | null;
      car?: { model: string; brand?: { name: string } | null } | null;
    };
    vehicle?: {
      id: number;
      customLabel: string | null;
      vin: string | null;
      car?: { model: string; brand?: { name: string } | null } | null;
    } | null;
    catalogServiceType?: { id: number; name: string } | null;
  }) {
    const start = row.startsAt ?? row.visitDate;
    const end =
      row.endsAt ?? new Date(start.getTime() + 60 * 60 * 1000);
    const vehicleLabel = row.vehicle
      ? formatVehicleLabel(row.vehicle)
      : null;
    return {
      id: row.id,
      clientId: row.userId,
      vehicleId: row.vehicleId ?? null,
      vehicle: row.vehicle
        ? {
            id: row.vehicle.id,
            label: vehicleLabel,
            vin: row.vehicle.vin,
            customLabel: row.vehicle.customLabel,
            carBrand: row.vehicle.car?.brand?.name ?? null,
            carModelName: row.vehicle.car?.model ?? null,
          }
        : null,
      client: row.user,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      serviceType: row.serviceType,
      serviceTypeId: row.serviceTypeId,
      catalogServiceType: row.catalogServiceType,
      priceRub: row.priceRub ?? 0,
      managerName: row.managerName,
      location: (row.location ?? DEFAULT_CRM_LOCATION) as CrmLocationCode,
      title: row.serviceType,
      reviewSmsSentAt: row.reviewSmsSentAt
        ? row.reviewSmsSentAt.toISOString()
        : null,
    };
  }
}
