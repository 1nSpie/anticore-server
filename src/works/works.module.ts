import { MediaModule } from "../media/media.module";
import { Module } from "@nestjs/common";
import { WorksController } from "./works.controller";
import { WorksService } from "./works.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [MediaModule, PrismaModule],
  controllers: [WorksController],
  providers: [WorksService],
  exports: [WorksService],
})
export class WorksModule {}
