import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { VkService } from './vk.service';
import { VkController } from './vk.controller';

@Module({
  imports: [CrmModule],
  controllers: [VkController],
  providers: [VkService],
  exports: [VkService],
})
export class VkModule {}
