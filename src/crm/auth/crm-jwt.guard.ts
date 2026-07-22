import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { CrmAuthService } from "./crm-auth.service";

@Injectable()
export class CrmJwtGuard implements CanActivate {
  constructor(private readonly crmAuth: CrmAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const payload = this.crmAuth.verifyToken(req.headers.authorization);
    if (!payload) {
      throw new UnauthorizedException("Требуется вход в CRM");
    }
    (req as Request & { crmAdminId?: number }).crmAdminId = payload.sub;
    return true;
  }
}
