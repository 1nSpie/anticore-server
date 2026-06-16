import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AdminAuthModule } from "../../auth/admin-auth.module";
import { CabinetAuthModule } from "../auth/cabinet-auth.module";
import { CabinetAdminService } from "./cabinet-admin.service";
import { CabinetAdminController } from "./cabinet-admin.controller";

@Module({
  imports: [PrismaModule, AdminAuthModule, CabinetAuthModule],
  controllers: [CabinetAdminController],
  providers: [CabinetAdminService],
})
export class CabinetAdminModule {}
