import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../auth/admin-auth.module";
import { StorageModule } from "../storage/storage.module";
import { CheckinService } from "./checkin.service";
import { CrmCheckinsController, StaffCheckinController } from "./checkin.controller";
import { CrmTasksController, StaffTasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { CrmRegulationController, StaffRegulationController } from "./regulation.controller";
import { RegulationService } from "./regulation.service";
import { NotificationsService } from "./notifications.service";
import { StaffNotificationsController } from "./notifications.controller";
import { StaffEventsGateway } from "./staff-events.gateway";
import { StaffAdminController } from "./staff-admin.controller";
import { StaffAdminService } from "./staff-admin.service";
import { StaffAssignmentsService } from "./staff-assignments.service";
import { StaffAuditService } from "./staff-audit.service";
import { StaffAuthController } from "./staff-auth.controller";
import { StaffAuthService } from "./staff-auth.service";
import { StaffJwtGuard } from "./staff-jwt.guard";
import { AppointmentAssigneesController, StaffScheduleController } from "./staff-schedule.controller";
import { StaffTokenService } from "./staff-token.service";

/** Учётные записи сотрудников (мастера): вход, роли, журнал. Админ управляет ими через `/crm/staff`. */
@Module({
  imports: [AdminAuthModule, StorageModule],
  controllers: [StaffAuthController, StaffAdminController, StaffScheduleController, AppointmentAssigneesController, StaffCheckinController, CrmCheckinsController, StaffTasksController, CrmTasksController, StaffRegulationController, CrmRegulationController, StaffNotificationsController],
  providers: [StaffTokenService, StaffAuditService, StaffAuthService, StaffAdminService, StaffAssignmentsService, CheckinService, TasksService, RegulationService, NotificationsService, StaffEventsGateway, StaffJwtGuard],
  exports: [StaffJwtGuard, StaffTokenService, StaffAuditService, NotificationsService],
})
export class StaffModule {}
