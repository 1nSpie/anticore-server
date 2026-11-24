import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  formatVehicleLabel,
  validateVin,
} from "../crm/common/crm-format.util";
import { validatePlate, validateVehicleYear } from "../common/vehicle.util";

export type VehicleCarInclude = {
  model: string;
  brand?: { name: string } | null;
  segment?: number;
};

export type VehicleRow = {
  id: number;
  userId: number;
  carId: number | null;
  customLabel: string | null;
  vin: string | null;
  year: number | null;
  plate: string | null;
  isPrimary: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  car?: VehicleCarInclude | null;
};

export type UpsertVehicleInput = {
  carId?: number | null;
  customLabel?: string | null;
  vin?: string | null;
  year?: number | null;
  plate?: string | null;
  isPrimary?: boolean;
};

/** Что обязательно при создании автомобиля через CRM: марка/модель и год выпуска. */
export type CreateVehicleOptions = { requireComplete?: boolean };

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
export class ClientVehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  toView(v: VehicleRow) {
    return {
      id: v.id,
      userId: v.userId,
      carId: v.carId,
      customLabel: v.customLabel,
      vin: v.vin,
      year: v.year,
      plate: v.plate,
      isPrimary: v.isPrimary,
      archivedAt: v.archivedAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      carBrand: v.car?.brand?.name ?? null,
      carModelName: v.car?.model ?? null,
      carSegment: v.car?.segment ?? null,
      label: formatVehicleLabel(v),
    };
  }

  async listForUser(userId: number, opts?: { includeArchived?: boolean }) {
    const rows = await this.prisma.clientVehicle.findMany({
      where: {
        userId,
        ...(opts?.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      include: vehicleInclude,
    });
    return rows.map((r) => this.toView(r));
  }

  async getForUser(userId: number, vehicleId: number) {
    const row = await this.prisma.clientVehicle.findFirst({
      where: { id: vehicleId, userId },
      include: vehicleInclude,
    });
    if (!row) throw new NotFoundException("Автомобиль не найден");
    return this.toView(row);
  }

  async assertOwnedActive(userId: number, vehicleId: number) {
    const row = await this.prisma.clientVehicle.findFirst({
      where: { id: vehicleId, userId, archivedAt: null },
    });
    if (!row) {
      throw new BadRequestException(
        "Автомобиль не найден у этого клиента или архивирован",
      );
    }
    return row;
  }

  async create(
    userId: number,
    input: UpsertVehicleInput,
    opts: CreateVehicleOptions = {},
  ) {
    await this.ensureUser(userId);
    const data = await this.normalizeInput(input);
    if (opts.requireComplete) assertVehicleComplete(data);
    const count = await this.prisma.clientVehicle.count({
      where: { userId, archivedAt: null },
    });
    const makePrimary = input.isPrimary === true || count === 0;

    if (makePrimary) {
      await this.prisma.clientVehicle.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const row = await this.prisma.clientVehicle.create({
      data: {
        userId,
        carId: data.carId,
        customLabel: data.customLabel,
        vin: data.vin,
        year: data.year,
        plate: data.plate,
        isPrimary: makePrimary,
      },
      include: vehicleInclude,
    });

    await this.syncLegacyFields(userId);
    return this.toView(row);
  }

  async update(userId: number, vehicleId: number, input: UpsertVehicleInput) {
    const existing = await this.prisma.clientVehicle.findFirst({
      where: { id: vehicleId, userId },
    });
    if (!existing) throw new NotFoundException("Автомобиль не найден");
    if (existing.archivedAt) {
      throw new BadRequestException("Нельзя изменить архивный автомобиль");
    }

    const data = await this.normalizeInput(input, existing);

    if (input.isPrimary === true) {
      await this.prisma.clientVehicle.updateMany({
        where: { userId, isPrimary: true, NOT: { id: vehicleId } },
        data: { isPrimary: false },
      });
    }

    const row = await this.prisma.clientVehicle.update({
      where: { id: vehicleId },
      data: {
        ...(input.carId !== undefined || input.customLabel !== undefined
          ? { carId: data.carId, customLabel: data.customLabel }
          : {}),
        ...(input.vin !== undefined && { vin: data.vin }),
        ...(input.year !== undefined && { year: data.year }),
        ...(input.plate !== undefined && { plate: data.plate }),
        ...(input.isPrimary === true && { isPrimary: true }),
      },
      include: vehicleInclude,
    });

    await this.syncLegacyFields(userId);
    return this.toView(row);
  }

  async archive(userId: number, vehicleId: number) {
    const existing = await this.prisma.clientVehicle.findFirst({
      where: { id: vehicleId, userId },
    });
    if (!existing) throw new NotFoundException("Автомобиль не найден");
    if (existing.archivedAt) return this.getForUser(userId, vehicleId);

    await this.prisma.clientVehicle.update({
      where: { id: vehicleId },
      data: { archivedAt: new Date(), isPrimary: false },
    });

    if (existing.isPrimary) {
      const next = await this.prisma.clientVehicle.findFirst({
        where: { userId, archivedAt: null },
        orderBy: { id: "asc" },
      });
      if (next) {
        await this.prisma.clientVehicle.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    await this.syncLegacyFields(userId);
    return this.getForUser(userId, vehicleId);
  }

  /**
   * Create client + optional first vehicle (CRM create flow).
   * Also used when legacy carId/customCar/vin are still posted.
   */
  async ensurePrimaryFromLegacy(
    userId: number,
    legacy: {
      carId?: number | null;
      customCar?: string | null;
      vin?: string | null;
      year?: number | null;
      plate?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const year = legacy.year != null ? validateVehicleYear(legacy.year) : undefined;
    const plate = legacy.plate?.trim() ? validatePlate(legacy.plate) : undefined;
    const hasCar =
      legacy.carId != null ||
      Boolean(legacy.customCar?.trim()) ||
      Boolean(legacy.vin?.trim());
    if (!hasCar) return null;

    const existing = await db.clientVehicle.findFirst({
      where: { userId, archivedAt: null },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    });
    if (existing) {
      return db.clientVehicle.update({
        where: { id: existing.id },
        data: {
          carId: legacy.carId !== undefined ? legacy.carId : existing.carId,
          customLabel:
            legacy.customCar !== undefined
              ? legacy.customCar?.trim() || null
              : existing.customLabel,
          vin:
            legacy.vin !== undefined
              ? legacy.vin?.trim()
                ? validateVin(legacy.vin)
                : null
              : existing.vin,
          ...(year !== undefined && { year }),
          ...(plate !== undefined && { plate }),
          isPrimary: true,
        },
        include: vehicleInclude,
      });
    }

    return db.clientVehicle.create({
      data: {
        userId,
        carId: legacy.carId ?? null,
        customLabel: legacy.customCar?.trim() || null,
        vin: legacy.vin?.trim() ? validateVin(legacy.vin) : null,
        year: year ?? null,
        plate: plate ?? null,
        isPrimary: true,
      },
      include: vehicleInclude,
    });
  }

  /** Keep CabinetUser.carId/customCar/vin in sync with primary vehicle. */
  async syncLegacyFields(userId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const primary = await db.clientVehicle.findFirst({
      where: { userId, archivedAt: null, isPrimary: true },
    });
    const fallback =
      primary ??
      (await db.clientVehicle.findFirst({
        where: { userId, archivedAt: null },
        orderBy: { id: "asc" },
      }));

    await db.cabinetUser.update({
      where: { id: userId },
      data: {
        carId: fallback?.carId ?? null,
        customCar: fallback?.customLabel ?? null,
        vin: fallback?.vin ?? null,
      },
    });
  }

  private async ensureUser(userId: number) {
    const u = await this.prisma.cabinetUser.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!u) throw new NotFoundException("Клиент не найден");
  }

  private async normalizeInput(
    input: UpsertVehicleInput,
    existing?: {
      carId: number | null;
      customLabel: string | null;
      vin: string | null;
      year?: number | null;
      plate?: string | null;
    },
  ) {
    let carId =
      input.carId !== undefined ? input.carId : (existing?.carId ?? null);
    let customLabel =
      input.customLabel !== undefined
        ? input.customLabel?.trim() || null
        : (existing?.customLabel ?? null);
    let vin =
      input.vin !== undefined
        ? input.vin?.trim()
          ? validateVin(input.vin)
          : null
        : (existing?.vin ?? null);
    const year =
      input.year !== undefined
        ? input.year != null
          ? validateVehicleYear(input.year)
          : null
        : (existing?.year ?? null);
    const plate =
      input.plate !== undefined
        ? input.plate?.trim()
          ? validatePlate(input.plate)
          : null
        : (existing?.plate ?? null);

    if (input.customLabel !== undefined && customLabel) {
      carId = null;
    }
    if (input.carId !== undefined && carId != null) {
      customLabel = null;
      await this.assertCatalogCar(carId);
    }

    if (!carId && !customLabel && !vin) {
      throw new BadRequestException(
        "Укажите автомобиль из каталога, свободное название или VIN",
      );
    }

    return { carId, customLabel, vin, year, plate };
  }

  private async assertCatalogCar(carId: number) {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw new BadRequestException("Автомобиль не найден в каталоге");
    }
  }
}

/** Марка/модель (каталог или текст) и год — минимум для карточки автомобиля по ТЗ. */
export function assertVehicleComplete(data: {
  carId: number | null;
  customLabel: string | null;
  year: number | null;
}) {
  const missing: string[] = [];
  if (!data.carId && !data.customLabel) missing.push("марка и модель");
  if (data.year == null) missing.push("год выпуска");
  if (missing.length) {
    throw new BadRequestException(`Не заполнено: ${missing.join(", ")}`);
  }
}
