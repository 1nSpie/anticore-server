import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../auth/admin-auth.module";
import { ContentAdminGuard } from "./content-admin.guard";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [AdminAuthModule],
  controllers: [MediaController],
  providers: [MediaService, ContentAdminGuard],
  exports: [ContentAdminGuard, AdminAuthModule],
})
export class MediaModule {}
