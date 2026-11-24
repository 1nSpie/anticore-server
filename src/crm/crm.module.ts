import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminAuthModule } from "../auth/admin-auth.module";
import { CabinetAuthModule } from "../cabinet/auth/cabinet-auth.module";
import { SmsModule } from "../cabinet/sms/sms.module";
import { ClientVehiclesModule } from "../client-vehicles/client-vehicles.module";
import { CrmAppointmentsController } from "./appointments/crm-appointments.controller";
import { CrmAppointmentsService } from "./appointments/crm-appointments.service";
import { CrmCashController } from "./cash/crm-cash.controller";
import { CrmCashService } from "./cash/crm-cash.service";
import { CrmStockController } from "./stock/crm-stock.controller";
import { CrmStockService } from "./stock/crm-stock.service";
import { CrmClientVehiclesController } from "./clients/crm-client-vehicles.controller";
import { CrmClientsController } from "./clients/crm-clients.controller";
import { CrmClientsService } from "./clients/crm-clients.service";
import { CrmDocumentsController } from "./documents/crm-documents.controller";
import { CrmDocumentsService } from "./documents/crm-documents.service";
import { CrmExecutionController } from "./execution/crm-execution.controller";
import { CrmExecutionService } from "./execution/crm-execution.service";
import { CrmInspectionController } from "./inspection/crm-inspection.controller";
import { CrmInspectionService } from "./inspection/crm-inspection.service";
import { CrmLeadsController } from "./leads/crm-leads.controller";
import { CrmLeadsService } from "./leads/crm-leads.service";
import { CrmLeadsScheduler } from "./leads/crm-leads.scheduler";
import { CrmOrganizationController } from "./organization/crm-organization.controller";
import { CrmOrganizationService } from "./organization/crm-organization.service";
import { CrmServiceCatalogController, CrmWorkItemsController } from "./services/crm-services.controller";
import { CrmServicesService } from "./services/crm-services.service";
import { CrmSettingsController } from "./settings/crm-settings.controller";
import { CrmSettingsService } from "./settings/crm-settings.service";
import { CrmSmsScheduler } from "./sms/crm-sms.scheduler";
import { CrmSmsService } from "./sms/crm-sms.service";
import { StaffModule } from "../staff/staff.module";
import { StorageModule } from "../storage/storage.module";

/** CRM API — доступ только с JWT админ-панели (`/admin/login`). */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    AdminAuthModule,
    CabinetAuthModule,
    SmsModule,
    ClientVehiclesModule,
    StaffModule,
    StorageModule,
  ],
  controllers: [
    CrmClientsController,
    CrmClientVehiclesController,
    CrmAppointmentsController,
    CrmLeadsController,
    CrmSettingsController,
    CrmOrganizationController,
    CrmInspectionController,
    CrmDocumentsController,
    CrmServiceCatalogController,
    CrmWorkItemsController,
    CrmExecutionController,
    CrmCashController,
    CrmStockController,
  ],
  providers: [
    CrmClientsService,
    CrmAppointmentsService,
    CrmLeadsService,
    CrmLeadsScheduler,
    CrmSettingsService,
    CrmOrganizationService,
    CrmInspectionService,
    CrmDocumentsService,
    CrmServicesService,
    CrmExecutionService,
    CrmCashService,
    CrmStockService,
    CrmSmsService,
    CrmSmsScheduler,
  ],
  exports: [CrmLeadsService],
})
export class CrmModule {}
