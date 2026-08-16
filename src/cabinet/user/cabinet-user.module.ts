import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ClientVehiclesModule } from "../../client-vehicles/client-vehicles.module";
import { CabinetAuthModule } from "../auth/cabinet-auth.module";
import { CabinetUserService } from "./cabinet-user.service";
import { CabinetUserController } from "./cabinet-user.controller";

@Module({
  imports: [PrismaModule, CabinetAuthModule, ClientVehiclesModule],
  controllers: [CabinetUserController],
  providers: [CabinetUserService],
})
export class CabinetUserModule {}
