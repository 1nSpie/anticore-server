import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../auth/admin-auth.module";
import { PushModule } from "../push/push.module";
import { AdminEventsGateway } from "./admin-events.gateway";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { AdminNotificationsService } from "./admin-notifications.service";

@Module({
  imports: [AdminAuthModule, PushModule],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService, AdminEventsGateway],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {}
