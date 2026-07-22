import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { CabinetAuthModule } from "../auth/cabinet-auth.module";
import { CabinetUserService } from "./cabinet-user.service";
import { CabinetUserController } from "./cabinet-user.controller";

@Module({
  imports: [PrismaModule, CabinetAuthModule],
  controllers: [CabinetUserController],
  providers: [CabinetUserService],
})
export class CabinetUserModule {}
