import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizePhoneRu } from "../../cabinet/common/phone.util";
import { CrmLoginDto } from "./dto/crm-login.dto";

type CrmJwtPayload = {
  sub: number;
  role: "crm_admin";
};

@Injectable()
export class CrmAuthService {
  private readonly jwtSecret = process.env.JWT_SECRET?.trim();

  constructor(private readonly prisma: PrismaService) {}

  async login(dto: CrmLoginDto): Promise<{ accessToken: string }> {
    if (!this.jwtSecret) {
      throw new Error("JWT_SECRET не задан");
    }
    const phone = normalizePhoneRu(dto.phone);
    const admin = await this.prisma.crmAdmin.findUnique({ where: { phone } });
    if (!admin) {
      throw new UnauthorizedException("Неверный телефон или пароль");
    }
    const ok = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Неверный телефон или пароль");
    }
    const token = jwt.sign(
      { sub: admin.id, role: "crm_admin" } satisfies CrmJwtPayload,
      this.jwtSecret,
      { expiresIn: "24h" },
    );
    return { accessToken: token };
  }

  verifyToken(authHeader?: string): CrmJwtPayload | null {
    if (!this.jwtSecret || !authHeader?.startsWith("Bearer ")) return null;
    try {
      const payload = jwt.verify(
        authHeader.slice(7),
        this.jwtSecret,
      ) as unknown as CrmJwtPayload;
      if (payload.role !== "crm_admin") return null;
      return payload;
    } catch {
      return null;
    }
  }

  async ensureBootstrapAdmin(): Promise<void> {
    const phoneRaw = process.env.CRM_ADMIN_PHONE?.trim();
    const password = process.env.CRM_ADMIN_PASSWORD?.trim();
    if (!phoneRaw || !password) return;

    const phone = normalizePhoneRu(phoneRaw);
    const existing = await this.prisma.crmAdmin.findUnique({ where: { phone } });
    if (existing) return;

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.crmAdmin.create({
      data: { phone, passwordHash },
    });
  }
}
