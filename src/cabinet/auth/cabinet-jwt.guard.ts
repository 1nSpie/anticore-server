import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { CabinetAuthService } from "./cabinet-auth.service";

/**
 * Проверка access JWT клиента личного кабинета (Bearer).
 * Админский токен сюда не подходит — у него другой payload.
 */
@Injectable()
export class CabinetJwtGuard implements CanActivate {
  constructor(private readonly cabinetAuth: CabinetAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    const parsed = this.cabinetAuth.verifyAccessToken(auth);
    if (!parsed) {
      throw new UnauthorizedException("Требуется вход в личный кабинет");
    }
    await this.cabinetAuth.assertActiveCabinetUser(parsed.userId);
    req.cabinetUserId = parsed.userId;
    return true;
  }
}
