import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Request } from "express";
import { CheckinStatus, CrmLocation, Prisma } from "../../generated/prisma/client";
import { mskDateAsUtcMidnight } from "../crm/common/crm-work-hours";
import { PrismaService } from "../prisma/prisma.service";
import { BRANCH_GEO, CHECKIN_RADIUS_M, GEO_RETENTION_DAYS, distanceMeters, nearestBranch } from "./branch-geo";
import { CheckinDto, CheckinListQueryDto } from "./dto/checkin.dto";
import { NotificationType } from "./notification-types";
import { NotificationsService } from "./notifications.service";
import { StaffAuditAction, StaffAuditService } from "./staff-audit.service";
import { StaffPrincipal } from "./staff-jwt.guard";

const mine = {
  id: true,
  date: true,
  location: true,
  distanceM: true,
  outOfRadius: true,
  status: true,
  createdAt: true,
  decidedAt: true,
} satisfies Prisma.CheckinSelect;

@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Согласие на обработку геолокации — один раз, до первого чекина. */
  async giveGeoConsent(staffId: number, req: Request) {
    await this.prisma.staff.update({ where: { id: staffId }, data: { geoConsentAt: new Date() } });
    await this.audit.log({ action: StaffAuditAction.GEO_CONSENT, actor: (req["staff"] as StaffPrincipal).login, staffId, req });
    return { geoConsent: true };
  }

  /** Состояние чекина на сегодня + дано ли согласие — для главной экрана мастера. */
  async today(staffId: number) {
    const [staff, checkin] = await Promise.all([
      this.prisma.staff.findUnique({ where: { id: staffId }, select: { geoConsentAt: true } }),
      this.prisma.checkin.findUnique({
        where: { staffId_date: { staffId, date: mskDateAsUtcMidnight(new Date()) } },
        select: mine,
      }),
    ]);
    return { geoConsent: !!staff?.geoConsentAt, checkin };
  }

  async checkin(principal: StaffPrincipal, dto: CheckinDto, req: Request) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: principal.id },
      select: { geoConsentAt: true, locations: true },
    });
    if (!staff?.geoConsentAt) throw new ForbiddenException("Нужно согласие на обработку геолокации");

    const point = { lat: dto.lat, lng: dto.lng };
    const location: CrmLocation = dto.location ?? nearestBranch(point, staff.locations);
    const distanceM = distanceMeters(point, BRANCH_GEO[location]);
    const date = mskDateAsUtcMidnight(new Date());
    const data = {
      location,
      lat: dto.lat,
      lng: dto.lng,
      accuracyM: dto.accuracyM ?? null,
      distanceM,
      outOfRadius: distanceM > CHECKIN_RADIUS_M,
    };

    const existing = await this.prisma.checkin.findUnique({
      where: { staffId_date: { staffId: principal.id, date } },
      select: { id: true, status: true },
    });
    // Отклонённый чекин можно повторить; остальные — один в сутки
    if (existing && existing.status !== CheckinStatus.REJECTED) {
      throw new ConflictException("Чекин за сегодня уже есть");
    }

    try {
      const saved = existing
        ? await this.prisma.checkin.update({
            where: { id: existing.id },
            data: { ...data, status: CheckinStatus.PENDING, decidedAt: null, createdAt: new Date() },
            select: mine,
          })
        : await this.prisma.checkin.create({ data: { staffId: principal.id, date, ...data }, select: mine });
      await this.audit.log({
        action: StaffAuditAction.CHECKIN,
        actor: principal.login,
        staffId: principal.id,
        req,
        meta: { checkinId: saved.id, location, distanceM, outOfRadius: data.outOfRadius },
      });
      return saved;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Чекин за сегодня уже есть");
      }
      throw e;
    }
  }

  /** Админ: чекины за день (по умолчанию сегодня) — без координат, только расстояние и пометка. */
  list(q: CheckinListQueryDto) {
    const date = q.date ? new Date(`${q.date.slice(0, 10)}T00:00:00Z`) : mskDateAsUtcMidnight(new Date());
    return this.prisma.checkin.findMany({
      where: { date, location: q.location },
      orderBy: { createdAt: "asc" },
      select: { ...mine, accuracyM: true, staff: { select: { id: true, fullName: true, login: true } } },
    });
  }

  async decide(id: number, status: "CONFIRMED" | "REJECTED", req: Request) {
    const checkin = await this.prisma.checkin.findUnique({ where: { id }, select: { id: true, staffId: true } });
    if (!checkin) throw new NotFoundException("Чекин не найден");
    if (!Object.values(CheckinStatus).includes(status as CheckinStatus)) throw new BadRequestException("Некорректный статус");
    const saved = await this.prisma.checkin.update({
      where: { id },
      data: { status, decidedAt: new Date() },
      select: mine,
    });
    await this.audit.log({
      action: status === "CONFIRMED" ? StaffAuditAction.CHECKIN_CONFIRMED : StaffAuditAction.CHECKIN_REJECTED,
      actor: "admin",
      staffId: checkin.staffId,
      req,
      meta: { checkinId: id },
    });
    await this.notifications.notify([checkin.staffId], {
      type: status === "CONFIRMED" ? NotificationType.CHECKIN_CONFIRMED : NotificationType.CHECKIN_REJECTED,
      title: status === "CONFIRMED" ? "Чекин подтверждён — вы на смене" : "Чекин отклонён",
      body: status === "CONFIRMED" ? null : "Отметьтесь снова на месте или обратитесь к администратору",
      link: "/staff",
    });
    return saved;
  }

  /** Координаты чекинов хранятся год, затем обнуляются (сам чекин и расстояние остаются для табеля). */
  @Cron("30 3 * * *", { timeZone: "Europe/Moscow" })
  async purgeOldCoordinates() {
    const cutoff = new Date(Date.now() - GEO_RETENTION_DAYS * 86_400_000);
    await this.prisma.checkin.updateMany({
      where: { createdAt: { lt: cutoff }, OR: [{ lat: { not: null } }, { lng: { not: null } }] },
      data: { lat: null, lng: null },
    });
  }
}
