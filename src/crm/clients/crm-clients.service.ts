import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CabinetAuthService } from "../../cabinet/auth/cabinet-auth.service";
import { ClientVehiclesService } from "../../client-vehicles/client-vehicles.service";
import { normalizePhoneRu } from "../../cabinet/common/phone.util";
import {
  formatCarModel,
  formatClientFio,
  formatVehicleLabel,
  validateVin,
} from "../common/crm-format.util";
import { CrmSmsService } from "../sms/crm-sms.service";
import {
  CreateCrmClientDto,
  CrmBroadcastSmsDto,
  ListCrmClientsQueryDto,
  UpdateCrmClientDto,
} from "./dto/crm-client.dto";

const vehicleInclude = {
  car: {
    select: {
      model: true,
      segment: true,
      brand: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class CrmClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmSms: CrmSmsService,
    private readonly cabinetAuth: CabinetAuthService,
    private readonly vehicles: ClientVehiclesService,
  ) {}

  async list(query: ListCrmClientsQueryDto = {}) {
    const { q, filter = "all", page = 1, limit = 50 } = query;
    const take = Math.min(Math.max(limit, 1), 200);
    const skip = (Math.max(page, 1) - 1) * take;

    const where: Prisma.CabinetUserWhereInput = {};

    if (q?.trim()) {
      const term = q.trim();
      const digits = term.replace(/\D/g, "");
      where.OR = [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { patronymic: { contains: term, mode: "insensitive" } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ];
    }

    switch (filter) {
      case "lk":
        where.phoneVerified = true;
        break;
      case "no_lk":
        where.phoneVerified = false;
        break;
      case "blocked":
        where.blocked = true;
        break;
      case "has_visits":
        where.visits = { some: {} };
        break;
    }

    const [items, total] = await Promise.all([
      this.prisma.cabinetUser.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take,
        include: {
          car: { include: { brand: { select: { name: true } } } },
          vehicles: {
            where: { archivedAt: null },
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
            include: vehicleInclude,
          },
          notificationSettings: {
            select: { smsEnabled: true, notifyReminder: true },
          },
          _count: { select: { visits: true } },
        },
      }),
      this.prisma.cabinetUser.count({ where }),
    ]);

    return {
      items: items.map((u) => this.toClientView(u)),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  async get(id: number, vehicleId?: number) {
    const user = await this.prisma.cabinetUser.findUnique({
      where: { id },
      include: {
        car: { include: { brand: { select: { name: true } } } },
        vehicles: {
          where: { archivedAt: null },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
          include: vehicleInclude,
        },
        notificationSettings: true,
        visits: {
          where: vehicleId ? { vehicleId } : undefined,
          orderBy: { startsAt: "desc" },
          take: 50,
          include: {
            vehicle: { include: vehicleInclude },
          },
        },
        _count: { select: { visits: true } },
      },
    });
    if (!user) throw new NotFoundException("Клиент не найден");
    return this.toClientView(user);
  }

  async create(dto: CreateCrmClientDto) {
    const phone = normalizePhoneRu(dto.phone);
    if (dto.vin?.trim()) validateVin(dto.vin);
    if (dto.carId != null) await this.assertCarExists(dto.carId);

    const exists = await this.prisma.cabinetUser.findUnique({
      where: { phone },
    });
    if (exists) {
      throw new BadRequestException("Клиент с таким телефоном уже существует");
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
    const user = await this.prisma.cabinetUser.create({
      data: {
        phone,
        passwordHash,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        patronymic: dto.patronymic?.trim() || null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        carId: dto.carId ?? null,
        customCar: dto.customCar?.trim() || null,
        vin: dto.vin?.trim() ? validateVin(dto.vin) : null,
        adminComment: dto.adminComment?.trim() || null,
        phoneVerified: false,
        notificationSettings: { create: {} },
      },
    });

    await this.vehicles.ensurePrimaryFromLegacy(user.id, {
      carId: dto.carId ?? null,
      customCar: dto.customCar ?? null,
      vin: dto.vin ?? null,
    });
    await this.vehicles.syncLegacyFields(user.id);

    return this.get(user.id);
  }

  async update(id: number, dto: UpdateCrmClientDto) {
    const existing = await this.prisma.cabinetUser.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Клиент не найден");

    if (dto.vin !== undefined && dto.vin?.trim()) validateVin(dto.vin);
    if (dto.carId !== undefined && dto.carId !== null) {
      await this.assertCarExists(dto.carId);
    }

    const data: Prisma.CabinetUserUpdateInput = {};
    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName?.trim() || null;
    }
    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName?.trim() || null;
    }
    if (dto.patronymic !== undefined) {
      data.patronymic = dto.patronymic?.trim() || null;
    }
    if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.adminComment !== undefined) {
      data.adminComment = dto.adminComment?.trim() || null;
    }
    if (dto.blocked !== undefined) {
      data.blocked = dto.blocked;
      data.blockedAt = dto.blocked ? new Date() : null;
    }

    const hasLegacyCar =
      dto.carId !== undefined ||
      dto.customCar !== undefined ||
      dto.vin !== undefined;

    if (hasLegacyCar) {
      await this.vehicles.ensurePrimaryFromLegacy(id, {
        carId: dto.carId,
        customCar: dto.customCar,
        vin: dto.vin,
      });
      await this.vehicles.syncLegacyFields(id);
    }

    const hasProfileChanges = Object.keys(data).length > 0;
    if (hasProfileChanges) {
      await this.prisma.cabinetUser.update({ where: { id }, data });
      if (dto.blocked === true) {
        await this.cabinetAuth.revokeAllSessions(id);
      }
    }

    const notifFields =
      dto.smsEnabled !== undefined || dto.notifyReminder !== undefined;
    if (notifFields) {
      await this.prisma.notificationSettings.upsert({
        where: { userId: id },
        create: {
          userId: id,
          smsEnabled: dto.smsEnabled ?? true,
          notifyReminder: dto.notifyReminder ?? true,
        },
        update: {
          ...(dto.smsEnabled !== undefined && { smsEnabled: dto.smsEnabled }),
          ...(dto.notifyReminder !== undefined && {
            notifyReminder: dto.notifyReminder,
          }),
        },
      });
    }

    return this.get(id);
  }

  async remove(id: number) {
    const user = await this.prisma.cabinetUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Клиент не найден");
    await this.prisma.cabinetUser.delete({ where: { id } });
    return { message: "Удалено" };
  }

  async sendReviewNow(clientId: number) {
    const visit = await this.prisma.visitHistory.findFirst({
      where: { userId: clientId },
      orderBy: { startsAt: "desc" },
      include: {
        user: {
          include: { car: { include: { brand: { select: { name: true } } } } },
        },
        vehicle: { include: vehicleInclude },
      },
    });
    if (!visit) {
      throw new BadRequestException("У клиента нет записей для отзыва");
    }
    await this.crmSms.sendReviewSms(visit);
    return { message: "SMS с запросом отзыва отправлено" };
  }

  async broadcast(dto: CrmBroadcastSmsDto, clientIp?: string) {
    const users = dto.userId
      ? await this.prisma.cabinetUser.findMany({ where: { id: dto.userId } })
      : await this.prisma.cabinetUser.findMany({ where: { blocked: false } });

    let sent = 0;
    let failed = 0;
    for (const user of users) {
      try {
        await this.crmSms.sendRaw(user.phone, dto.message, "broadcast", {
          clientIp,
        });
        sent++;
      } catch {
        failed++;
      }
    }
    return { total: users.length, sent, failed };
  }

  private async assertCarExists(carId: number) {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw new BadRequestException("Автомобиль не найден в каталоге");
    }
  }

  private toClientView(user: {
    id: number;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
    birthDate: Date | null;
    carId: number | null;
    customCar: string | null;
    vin: string | null;
    adminComment: string | null;
    blocked?: boolean;
    phoneVerified?: boolean;
    blockedAt?: Date | null;
    createdAt: Date;
    car?: { model: string; brand?: { name: string } | null } | null;
    vehicles?: Array<{
      id: number;
      userId: number;
      carId: number | null;
      customLabel: string | null;
      vin: string | null;
      isPrimary: boolean;
      archivedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      car?: {
        model: string;
        segment?: number;
        brand?: { name: string } | null;
      } | null;
    }>;
    notificationSettings?: {
      smsEnabled: boolean;
      notifyReminder: boolean;
    } | null;
    visits?: Array<{
      id: number;
      visitDate: Date;
      startsAt: Date | null;
      endsAt: Date | null;
      serviceType: string;
      serviceTypeId: number | null;
      diskLink: string | null;
      managerName: string | null;
      priceRub: number | null;
      vehicleId?: number | null;
      vehicle?: {
        id: number;
        customLabel: string | null;
        vin: string | null;
        car?: {
          model: string;
          brand?: { name: string } | null;
        } | null;
      } | null;
    }>;
    _count?: { visits: number };
  }) {
    const vehicles = (user.vehicles ?? []).map((v) =>
      this.vehicles.toView(v),
    );
    const primary = vehicles.find((v) => v.isPrimary) ?? vehicles[0];
    const legacyLabel = formatCarModel(user);

    return {
      id: user.id,
      phone: user.phone,
      fio: formatClientFio(user) || user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      patronymic: user.patronymic,
      birthDate: user.birthDate,
      carId: primary?.carId ?? user.carId,
      carBrand: primary?.carBrand ?? user.car?.brand?.name ?? null,
      carModelName: primary?.carModelName ?? user.car?.model ?? null,
      carModel: primary?.label || legacyLabel,
      customCar: primary?.customLabel ?? user.customCar,
      vin: primary?.vin ?? user.vin,
      vehicles,
      adminComment: user.adminComment,
      blocked: user.blocked ?? false,
      phoneVerified: user.phoneVerified ?? false,
      createdAt: user.createdAt,
      visitCount: user._count?.visits ?? user.visits?.length ?? 0,
      notificationSettings: user.notificationSettings
        ? {
            smsEnabled: user.notificationSettings.smsEnabled,
            notifyReminder: user.notificationSettings.notifyReminder,
          }
        : null,
      visits: user.visits?.map((v) => ({
        id: v.id,
        visitDate: v.visitDate,
        startsAt: v.startsAt,
        endsAt: v.endsAt,
        serviceType: v.serviceType,
        serviceTypeId: v.serviceTypeId,
        diskLink: v.diskLink,
        managerName: v.managerName,
        priceRub: v.priceRub,
        vehicleId: v.vehicleId ?? null,
        vehicleLabel: v.vehicle
          ? formatVehicleLabel(v.vehicle)
          : null,
        vehicleVin: v.vehicle?.vin ?? null,
      })),
    };
  }
}
