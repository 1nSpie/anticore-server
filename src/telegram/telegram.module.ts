import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService], // Export for use in other modules
})
export class TelegramModule {}
