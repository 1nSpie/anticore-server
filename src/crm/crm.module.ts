import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminAuthModule } from "../auth/admin-auth.module";
import { CabinetAuthModule } from "../cabinet/auth/cabinet-auth.module";
import { SmsModule } from "../cabinet/sms/sms.module";
import { CrmAppointmentsController } from "./appointments/crm-appointments.controller";
import { CrmAppointmentsService } from "./appointments/crm-appointments.service";
import { CrmClientsController } from "./clients/crm-clients.controller";
import { CrmClientsService } from "./clients/crm-clients.service";
import { CrmLeadsController } from "./leads/crm-leads.controller";
import { CrmLeadsService } from "./leads/crm-leads.service";
import { CrmLeadsScheduler } from "./leads/crm-leads.scheduler";
import { CrmSettingsController } from "./settings/crm-settings.controller";
import { CrmSettingsService } from "./settings/crm-settings.service";
import { CrmSmsScheduler } from "./sms/crm-sms.scheduler";
import { CrmSmsService } from "./sms/crm-sms.service";

/** CRM API — доступ только с JWT админ-панели (`/admin/login`). */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    AdminAuthModule,
    CabinetAuthModule,
    SmsModule,
  ],
  controllers: [
    CrmClientsController,
    CrmAppointmentsController,
    CrmLeadsController,
    CrmSettingsController,
  ],
  providers: [
    CrmClientsService,
    CrmAppointmentsService,
    CrmLeadsService,
    CrmLeadsScheduler,
    CrmSettingsService,
    CrmSmsService,
    CrmSmsScheduler,
  ],
  exports: [CrmLeadsService],
})
export class CrmModule {}
