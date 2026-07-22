import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { SmsModule } from "../sms/sms.module";
import { SmartCaptchaService } from "../common/smartcaptcha.service";
import { CabinetAuthService } from "./cabinet-auth.service";
import { CabinetAuthController } from "./cabinet-auth.controller";
import { CabinetJwtGuard } from "./cabinet-jwt.guard";

@Module({
  imports: [PrismaModule, SmsModule],
  controllers: [CabinetAuthController],
  providers: [CabinetAuthService, CabinetJwtGuard, SmartCaptchaService],
  exports: [CabinetAuthService, CabinetJwtGuard],
})
export class CabinetAuthModule {}
