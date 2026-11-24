import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ADMIN_ENV_SUBJECT } from "../auth/admin-auth.service";
import * as bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { Prisma, Staff } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStaffDto, ResetStaffPasswordDto, StaffAuditQueryDto, UpdateStaffDto } from "./dto/staff.dto";
import { StaffAuditAction, StaffAuditService, adminActor } from "./staff-audit.service";
import { normalizeLogin } from "./staff-auth.service";
import { Request } from "express";

const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const publicSelect = {
  id: true,
  login: true,
  fullName: true,
  role: true,
  locations: true,
  blockedAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.StaffSelect;

function generatePassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

/** Управление сотрудниками из админки (доступ — AdminJwtGuard). */
@Injectable()
export class StaffAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
  ) {}

  list() {
    return this.prisma.staff.findMany({ select: publicSelect, orderBy: [{ blockedAt: "asc" }, { fullName: "asc" }] });
  }

  async create(dto: CreateStaffDto, req: Request) {
    const login = normalizeLogin(dto.login);
    if (await this.prisma.staff.findUnique({ where: { login } })) {
      throw new ConflictException("Сотрудник с таким логином уже есть");
    }
    const staff = await this.prisma.staff.create({
      data: {
        login,
        fullName: dto.fullName,
        role: dto.role,
        locations: dto.locations,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
      select: publicSelect,
    });
    await this.audit.log({
      action: StaffAuditAction.STAFF_CREATED,
      actor: adminActor(req),
      req,
      meta: { staffId: staff.id, login, role: staff.role },
    });
    return staff;
  }

  async update(id: number, dto: UpdateStaffDto, req: Request) {
    await this.requireStaff(id);
    const staff = await this.prisma.staff.update({
      where: { id },
      data: { fullName: dto.fullName, locations: dto.locations },
      select: publicSelect,
    });
    await this.audit.log({
      action: StaffAuditAction.STAFF_UPDATED,
      actor: adminActor(req),
      req,
      meta: { staffId: id, fullName: dto.fullName, locations: dto.locations },
    });
    return staff;
  }

  async setBlocked(id: number, blocked: boolean, req: Request) {
    await this.requireStaff(id);
    const staff = await this.prisma.staff.update({
      where: { id },
      data: { blockedAt: blocked ? new Date() : null },
      select: publicSelect,
    });
    await this.audit.log({
      action: blocked ? StaffAuditAction.STAFF_BLOCKED : StaffAuditAction.STAFF_UNBLOCKED,
      actor: adminActor(req),
      req,
      meta: { staffId: id },
    });
    return staff;
  }

  /** Новый пароль возвращается один раз — в БД остаётся только хэш. */
  async resetPassword(id: number, dto: ResetStaffPasswordDto, req: Request) {
    await this.requireStaff(id);
    const password = dto.password ?? generatePassword();
    await this.prisma.staff.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    await this.audit.log({ action: StaffAuditAction.PASSWORD_RESET, actor: adminActor(req), req, meta: { staffId: id } });
    return { password };
  }

  /**
   * Удалить мастера или администратора насовсем. Право только у администратора из env (`ADMIN_LOGIN`):
   * сотрудники-админы удалять не могут, даже друг друга. Начисления зарплаты остаются, имя сохраняется в них.
   */
  async remove(id: number, req: Request) {
    if (!isEnvAdmin(req)) throw new ForbiddenException("Удалять сотрудников может только главный администратор");
    const staff = await this.requireStaff(id);
    await this.prisma.staff.delete({ where: { id } });
    await this.audit.log({
      action: StaffAuditAction.STAFF_DELETED,
      actor: adminActor(req),
      req,
      meta: { staffId: id, login: staff.login, fullName: staff.fullName, role: staff.role },
    });
    return { message: "Сотрудник удалён" };
  }

  auditLog(q: StaffAuditQueryDto) {
    return this.audit.list({ staffId: q.staffId, action: q.action, take: q.limit ?? 50, skip: q.offset ?? 0 });
  }

  private async requireStaff(id: number): Promise<Staff> {
    if (!Number.isInteger(id)) throw new BadRequestException("Некорректный id");
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException("Сотрудник не найден");
    return staff;
  }
}

/** Запрос выполнен администратором из env (а не сотрудником с ролью ADMIN). */
export function isEnvAdmin(req?: unknown): boolean {
  return (req as { admin?: { id?: unknown } } | undefined)?.admin?.id === ADMIN_ENV_SUBJECT;
}
