import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const StaffAuditAction = {
  LOGIN: "LOGIN",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  STAFF_CREATED: "STAFF_CREATED",
  STAFF_UPDATED: "STAFF_UPDATED",
  STAFF_BLOCKED: "STAFF_BLOCKED",
  STAFF_UNBLOCKED: "STAFF_UNBLOCKED",
  PASSWORD_RESET: "PASSWORD_RESET",
  ASSIGNMENT_CHANGED: "ASSIGNMENT_CHANGED",
  GEO_CONSENT: "GEO_CONSENT",
  CHECKIN: "CHECKIN",
  CHECKIN_CONFIRMED: "CHECKIN_CONFIRMED",
  CHECKIN_REJECTED: "CHECKIN_REJECTED",
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_DONE: "TASK_DONE",
  TASK_CONFIRMED: "TASK_CONFIRMED",
  TASK_RETURNED: "TASK_RETURNED",
  TASK_CANCELLED: "TASK_CANCELLED",
  TASK_PHOTO_ADDED: "TASK_PHOTO_ADDED",
  TASK_PHOTO_DELETED: "TASK_PHOTO_DELETED",
  REGULATION_CHANGED: "REGULATION_CHANGED",
  REGULATION_PUBLISHED: "REGULATION_PUBLISHED",
  REGULATION_ACKED: "REGULATION_ACKED",
} as const;

/**
 * Подпись исполнителя для журнала по запросу, прошедшему `AdminJwtGuard`: логин сотрудника с ролью ADMIN
 * или «admin» для администратора из env (а также если запроса нет — например, в cron и тестах).
 */
export function adminActor(req?: unknown): string {
  const login = (req as { admin?: { login?: unknown } } | undefined)?.admin?.login;
  return typeof login === "string" && login ? login : "admin";
}

interface AuditEntry {
  action: string;
  actor: string;
  staffId?: number | null;
  req?: Request;
  meta?: Prisma.InputJsonValue;
}

@Injectable()
export class StaffAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    const ua = entry.req?.headers["user-agent"];
    await this.prisma.staffAuditLog.create({
      data: {
        action: entry.action,
        actor: entry.actor.slice(0, 64),
        staffId: entry.staffId ?? null,
        ip: entry.req?.ip?.slice(0, 64) ?? null,
        userAgent: typeof ua === "string" ? ua.slice(0, 300) : null,
        meta: entry.meta,
      },
    });
  }

  /** Неудачные попытки входа под логином за окно — для блокировки перебора. */
  countRecentFailures(login: string, since: Date): Promise<number> {
    return this.prisma.staffAuditLog.count({
      where: { action: StaffAuditAction.LOGIN_FAILED, actor: login.slice(0, 64), createdAt: { gte: since } },
    });
  }

  list(params: { staffId?: number; action?: string; take: number; skip: number }) {
    return this.prisma.staffAuditLog.findMany({
      where: { staffId: params.staffId, action: params.action },
      orderBy: { createdAt: "desc" },
      take: params.take,
      skip: params.skip,
    });
  }
}
