import { Module } from "@nestjs/common";

import { LegacyController } from "./legacy.controller";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [TelegramModule],
  controllers: [LegacyController],
})
export class LegacyModule {}

