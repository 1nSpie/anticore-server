import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ClientVehiclesService } from "./client-vehicles.service";

@Module({
  imports: [PrismaModule],
  providers: [ClientVehiclesService],
  exports: [ClientVehiclesService],
})
export class ClientVehiclesModule {}
