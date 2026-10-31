import { SetMetadata } from "@nestjs/common";
import { StaffRole } from "../../generated/prisma/client";

export const STAFF_ROLES_KEY = "staff_roles";

/** Роли, которым разрешён эндпоинт (используется вместе с StaffJwtGuard). */
export const Roles = (...roles: StaffRole[]) => SetMetadata(STAFF_ROLES_KEY, roles);
