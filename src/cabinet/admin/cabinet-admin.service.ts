import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CabinetAuthService } from "../auth/cabinet-auth.service";
import { SmsService } from "../sms/sms.service";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import { BroadcastSmsDto } from "./dto/broadcast-sms.dto";

@Injectable()
export class CabinetAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cabinetAuth: CabinetAuthService,
    private readonly sms: SmsService,
  ) {}

  async audit(
    adminSubject: string,
    action: string,
    targetUserId?: number,
    meta?: Record<string, unknown>,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        action,
        adminSubject,
        targetUserId: targetUserId ?? null,
        meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listUsers(
    adminSubject: string,
    q?: string,
    page = 1,
    limit = 20,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where =
      q && q.trim()
        ? {
            phone: { contains: q.replace(/\D/g, "") },
          }
        : {};
    const [items, total] = await Promise.all([
      this.prisma.cabinetUser.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
          customCar: true,
          phoneVerified: true,
          blocked: true,
          blockedAt: true,
          createdAt: true,
          car: {
            select: {
              id: true,
              model: true,
              brand: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.cabinetUser.count({ where }),
    ]);
    return { items, total, page: Math.max(page, 1), limit: take };
  }

  async getUser(adminSubject: string, id: number) {
    const user = await this.prisma.cabinetUser.findUnique({
      where: { id },
      include: {
        notificationSettings: true,
        car: {
          include: { brand: { select: { id: true, name: true } } },
        },
        _count: {
          select: {
            visits: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException("Пользователь не найден");
    const { passwordHash: _p, ...rest } = user;
    return rest;
  }

  async updateUser(adminSubject: string, id: number, dto: AdminUpdateUserDto) {
    const existing = await this.prisma.cabinetUser.findUnique({
      where: { id },
      include: { notificationSettings: true },
    });
    if (!existing) throw new NotFoundException("Пользователь не найден");

    if (dto.carId !== undefined && dto.carId !== null) {
      const car = await this.prisma.car.findUnique({ where: { id: dto.carId } });
      if (!car) {
        throw new BadRequestException("Автомобиль не найден в каталоге");
      }
    }

    const data: Prisma.CabinetUserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.patronymic !== undefined) data.patronymic = dto.patronymic;
    if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.customCar !== undefined) {
      const trimmed = dto.customCar?.trim() || null;
      data.customCar = trimmed;
      if (trimmed) data.car = { disconnect: true };
    }
    if (dto.carId !== undefined) {
      data.car =
        dto.carId === null
          ? { disconnect: true }
          : { connect: { id: dto.carId } };
      if (dto.carId !== null) data.customCar = null;
    }
    if (dto.blocked !== undefined) {
      data.blocked = dto.blocked;
      data.blockedAt = dto.blocked ? new Date() : null;
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

    if (!hasProfileChanges && !notifFields) {
      return this.getUser(adminSubject, id);
    }

    await this.audit(adminSubject, "admin.users.update", id, {
      fields: Object.keys(dto).filter((k) => dto[k as keyof AdminUpdateUserDto] !== undefined),
    });
    return this.getUser(adminSubject, id);
  }

  async broadcastSms(
    adminSubject: string,
    dto: BroadcastSmsDto,
    clientIp?: string,
  ) {
    const respectOptOut = dto.respectSmsOptOut !== false;
    const onlyActive = dto.onlyActive !== false;
    const message = dto.message.trim();
    if (!message) {
      throw new BadRequestException("Текст сообщения обязателен");
    }

    let users: { id: number; phone: string; blocked: boolean }[];

    if (dto.userIds?.length) {
      users = await this.prisma.cabinetUser.findMany({
        where: { id: { in: dto.userIds } },
        select: { id: true, phone: true, blocked: true },
      });
    } else {
      const where: Prisma.CabinetUserWhereInput = {};
      if (dto.q?.trim()) {
        where.phone = { contains: dto.q.replace(/\D/g, "") };
      }
      if (onlyActive) where.blocked = false;
      users = await this.prisma.cabinetUser.findMany({
        where,
        select: { id: true, phone: true, blocked: true },
        take: 500,
      });
    }

    if (onlyActive) {
      users = users.filter((u) => !u.blocked);
    }

    let skippedOptOut = 0;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const user of users) {
      if (respectOptOut) {
        const settings = await this.prisma.notificationSettings.findUnique({
          where: { userId: user.id },
        });
        if (settings && !settings.smsEnabled) {
          skippedOptOut++;
          continue;
        }
      }
      try {
        await this.sms.sendCode(user.phone, message, { clientIp });
        sent++;
      } catch (e) {
        failed++;
        if (errors.length < 5) {
          const msg = e instanceof Error ? e.message : "Ошибка SMS";
          errors.push(`${user.phone}: ${msg}`);
        }
      }
    }

    await this.audit(adminSubject, "admin.users.broadcast", undefined, {
      sent,
      failed,
      skippedOptOut,
      total: users.length,
      messagePreview: message.slice(0, 80),
    });

    return {
      total: users.length,
      sent,
      failed,
      skippedOptOut,
      errors,
    };
  }

  async setBlocked(adminSubject: string, id: number, blocked: boolean) {
    const user = await this.prisma.cabinetUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();
    await this.prisma.cabinetUser.update({
      where: { id },
      data: {
        blocked,
        blockedAt: blocked ? new Date() : null,
      },
    });
    if (blocked) {
      await this.cabinetAuth.revokeAllSessions(id);
    }
    await this.audit(adminSubject, blocked ? "admin.users.block" : "admin.users.unblock", id, {
      blocked,
    });
    return { id, blocked, sessionsRevoked: blocked };
  }

  async listVisits(_adminSubject: string, userId: number) {
    await this.ensureUser(userId);
    return this.prisma.visitHistory.findMany({
      where: { userId },
      orderBy: { visitDate: "desc" },
    });
  }

  async createVisit(
    adminSubject: string,
    userId: number,
    dto: { visitDate: string; serviceType: string; diskLink?: string },
  ) {
    await this.ensureUser(userId);
    const row = await this.prisma.visitHistory.create({
      data: {
        userId,
        visitDate: new Date(dto.visitDate),
        serviceType: dto.serviceType,
        diskLink: dto.diskLink ?? null,
      },
    });
    await this.audit(adminSubject, "admin.visits.create", userId, {
      visitId: row.id,
    });
    return row;
  }

  async updateVisit(
    adminSubject: string,
    userId: number,
    visitId: number,
    dto: {
      visitDate?: string;
      serviceType?: string;
      diskLink?: string;
    },
  ) {
    const v = await this.prisma.visitHistory.findFirst({
      where: { id: visitId, userId },
    });
    if (!v) throw new NotFoundException("Запись не найдена");
    const row = await this.prisma.visitHistory.update({
      where: { id: visitId },
      data: {
        ...(dto.visitDate && { visitDate: new Date(dto.visitDate) }),
        ...(dto.serviceType !== undefined && { serviceType: dto.serviceType }),
        ...(dto.diskLink !== undefined && { diskLink: dto.diskLink }),
      },
    });
    await this.audit(adminSubject, "admin.visits.update", userId, {
      visitId,
    });
    return row;
  }

  async deleteVisit(adminSubject: string, userId: number, visitId: number) {
    const v = await this.prisma.visitHistory.findFirst({
      where: { id: visitId, userId },
    });
    if (!v) throw new NotFoundException();
    await this.prisma.visitHistory.delete({ where: { id: visitId } });
    await this.audit(adminSubject, "admin.visits.delete", userId, { visitId });
    return { message: "Удалено" };
  }

  /** Только в `NODE_ENV=development` — для очистки тестовых аккаунтов. */
  async deleteUser(adminSubject: string, id: number) {
    if (process.env.NODE_ENV !== "development") {
      throw new ForbiddenException(
        "Удаление пользователей доступно только в режиме разработки",
      );
    }
    const user = await this.prisma.cabinetUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Пользователь не найден");
    await this.prisma.cabinetUser.delete({ where: { id } });
    await this.audit(adminSubject, "admin.users.delete", id, {
      phone: user.phone,
    });
    return { message: "Удалено" };
  }

  private async ensureUser(id: number) {
    const u = await this.prisma.cabinetUser.findUnique({ where: { id } });
    if (!u) throw new NotFoundException("Пользователь не найден");
    return u;
  }
}
