import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { Prisma, SiteLeadStatus } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CabinetAuthService } from "../auth/cabinet-auth.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateNotificationsDto } from "./dto/update-notifications.dto";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function sameDate(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function birthDateChangeMeta(changedAt: Date | null | undefined) {
  if (!changedAt) {
    return { canChangeBirthDate: true, nextBirthDateChangeAt: null as string | null };
  }
  const next = new Date(changedAt.getTime() + ONE_DAY_MS);
  const canChangeBirthDate = Date.now() >= next.getTime();
  return {
    canChangeBirthDate,
    nextBirthDateChangeAt: canChangeBirthDate ? null : next.toISOString(),
  };
}

const profileInclude = {
  notificationSettings: true,
  car: {
    include: {
      brand: { select: { id: true, name: true } },
    },
  },
} as const;

@Injectable()
export class CabinetUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cabinetAuth: CabinetAuthService,
  ) {}

  async getProfile(userId: number) {
    const user = await this.prisma.cabinetUser.findUnique({
      where: { id: userId },
      include: profileInclude,
    });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }
    const { passwordHash: _p, ...rest } = user;
    return {
      ...rest,
      ...birthDateChangeMeta(user.birthDateChangedAt),
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const existing = await this.prisma.cabinetUser.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new NotFoundException("Пользователь не найден");
    }

    if (dto.carId !== undefined && dto.carId !== null) {
      const car = await this.prisma.car.findUnique({
        where: { id: dto.carId },
      });
      if (!car) {
        throw new BadRequestException(
          "Автомобиль не найден в каталоге. Выберите марку и модель из списка.",
        );
      }
    }

    const data: Prisma.CabinetUserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.patronymic !== undefined) data.patronymic = dto.patronymic;
    if (dto.birthDate !== undefined) {
      const newDate = dto.birthDate ? new Date(dto.birthDate) : null;
      if (!sameDate(existing.birthDate, newDate)) {
        if (existing.birthDateChangedAt) {
          const nextChange = existing.birthDateChangedAt.getTime() + ONE_DAY_MS;
          if (Date.now() < nextChange) {
            throw new BadRequestException(
              "Дату рождения можно менять не чаще одного раза в сутки",
            );
          }
        }
        data.birthDate = newDate;
        data.birthDateChangedAt = new Date();
      }
    }
    if (dto.customCar !== undefined) {
      const trimmed = dto.customCar?.trim() || null;
      data.customCar = trimmed;
      if (trimmed) {
        data.car = { disconnect: true };
      }
    }
    if (dto.carId !== undefined) {
      data.car =
        dto.carId === null
          ? { disconnect: true }
          : { connect: { id: dto.carId } };
      if (dto.carId !== null) {
        data.customCar = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }

    const user = await this.prisma.cabinetUser.update({
      where: { id: userId },
      data,
      include: profileInclude,
    });
    const { passwordHash: _p, ...rest } = user;
    return {
      ...rest,
      ...birthDateChangeMeta(user.birthDateChangedAt),
    };
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
    refreshCookie: string | undefined,
  ) {
    if (dto.newPassword !== dto.newPasswordConfirm) {
      throw new BadRequestException("Новые пароли не совпадают");
    }
    const user = await this.prisma.cabinetUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException();
    }
    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!match) {
      throw new BadRequestException("Неверный текущий пароль");
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.cabinetUser.update({
      where: { id: userId },
      data: { passwordHash },
    });
    const keepId = this.cabinetAuth.parseRefreshId(refreshCookie);
    await this.cabinetAuth.revokeRefreshExcept(userId, keepId);
    return {
      message:
        "Пароль изменён. Другие устройства вышли из аккаунта; эта сессия активна.",
    };
  }

  async getNotificationSettings(userId: number) {
    const row = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });
    if (!row) {
      return this.prisma.notificationSettings.create({
        data: { userId },
      });
    }
    return row;
  }

  async updateNotificationSettings(
    userId: number,
    dto: UpdateNotificationsDto,
  ) {
    await this.prisma.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
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
    return this.getNotificationSettings(userId);
  }

  async listVisits(userId: number) {
    return this.prisma.visitHistory.findMany({
      where: { userId },
      orderBy: { visitDate: "desc" },
    });
  }

  async listPayments(userId: number) {
    return this.prisma.paymentHistory.findMany({
      where: { userId },
      orderBy: { paidAt: "desc" },
    });
  }

  async listLeads(userId: number) {
    const user = await this.prisma.cabinetUser.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    const leads = await this.prisma.siteLead.findMany({
      where: { phone: user.phone },
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

    return leads.map((lead) => ({
      ...lead,
      diskLink:
        lead.status === SiteLeadStatus.COMPLETED ? lead.diskLink : null,
    }));
  }
}
