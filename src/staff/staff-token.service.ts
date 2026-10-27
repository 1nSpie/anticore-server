import { Injectable, Logger } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { StaffRole } from "../../generated/prisma/client";

export const STAFF_JWT_AUDIENCE = "anticore-staff";
export const STAFF_JWT_ISSUER = "anticore-server";
/** D3: сессия мастера на телефоне — 30 дней. */
export const STAFF_TOKEN_TTL_DAYS = 30;

export interface StaffTokenPayload {
  sub: string;
  role: StaffRole;
  typ: "staff_access";
  iat: number;
  exp: number;
}

/** Токен сотрудника. Отличается от токенов админки и ЛК клиента по `aud` и `typ`. */
@Injectable()
export class StaffTokenService {
  private readonly logger = new Logger(StaffTokenService.name);
  private readonly secret: string | undefined;

  constructor() {
    const dedicated = process.env.STAFF_JWT_SECRET?.trim();
    if (dedicated) {
      this.secret = dedicated;
    } else {
      this.secret = process.env.JWT_SECRET?.trim();
      this.logger.warn(
        "STAFF_JWT_SECRET не задан — токены сотрудников подписываются общим JWT_SECRET. Задайте отдельный секрет.",
      );
    }
  }

  sign(staffId: number, role: StaffRole): string {
    return jwt.sign({ sub: String(staffId), role, typ: "staff_access" }, this.requireSecret(), {
      expiresIn: `${STAFF_TOKEN_TTL_DAYS}d`,
      audience: STAFF_JWT_AUDIENCE,
      issuer: STAFF_JWT_ISSUER,
    });
  }

  verify(token: string): StaffTokenPayload | null {
    try {
      const payload = jwt.verify(token, this.requireSecret(), {
        audience: STAFF_JWT_AUDIENCE,
        issuer: STAFF_JWT_ISSUER,
      }) as StaffTokenPayload;
      if (payload.typ !== "staff_access") return null;
      if (!Number.isInteger(Number(payload.sub))) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private requireSecret(): string {
    if (!this.secret) throw new Error("STAFF_JWT_SECRET / JWT_SECRET не задан");
    return this.secret;
  }
}
