import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { VkService } from './vk.service';

@Controller('vk')
export class VkController {
  constructor(private readonly vkService: VkService) {}

  @Post('send')
  async sendNotification(@Body() data: any) {
    try {
      const result = await this.vkService.sendMessage(data);
      return {
        statusCode: 200,
        message: 'Notification sent successfully',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}