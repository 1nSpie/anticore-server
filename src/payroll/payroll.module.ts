import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../auth/admin-auth.module";
import { StaffAuditService } from "../staff/staff-audit.service";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";

/** Зарплата: ставки, начисления по записям, доп. выплаты, ведомость. */
@Module({
  imports: [AdminAuthModule],
  controllers: [PayrollController],
  providers: [PayrollService, StaffAuditService],
  exports: [PayrollService],
})
export class PayrollModule {}
