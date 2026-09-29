import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { AdminAuthService } from "../auth/admin-auth.service";

// Compatible with existing admin sessions; does not change the paused SEC-1 rollout.
@Injectable()
export class ContentAdminGuard extends AdminJwtGuard {
  constructor(auth: AdminAuthService) {
    super(auth);
  }

  canActivate(context: ExecutionContext): boolean {
    super.canActivate(context);
    if (context.switchToHttp().getRequest().admin?.role !== "admin") {
      throw new ForbiddenException("Требуются права администратора");
    }
    return true;
  }
}
