import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { AdminAuthService } from "../auth/admin-auth.service";
import { PrismaService } from "../prisma/prisma.service";

// Compatible with existing admin sessions; does not change the paused SEC-1 rollout.
@Injectable()
export class ContentAdminGuard extends AdminJwtGuard {
  constructor(auth: AdminAuthService, @Optional() prisma?: PrismaService) {
    super(auth, prisma);
  }

  // async: для токена сотрудника-админа (sub = staff:<id>) родительский охранник проверяет учётку по БД — это надо дождаться
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    if (context.switchToHttp().getRequest().admin?.role !== "admin") {
      throw new ForbiddenException("Требуются права администратора");
    }
    return true;
  }
}
