import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { VkService } from "./vk.service";
import { CrmLeadsService } from "../crm/leads/crm-leads.service";
import { SitePriceRequestDto } from "../common/dto/site-form.dto";
import { normalizePhoneRu } from "../cabinet/common/phone.util";

@Controller("vk")
export class VkController {
  constructor(
    private readonly vkService: VkService,
    private readonly leadsService: CrmLeadsService,
  ) {}

  @Post("send")
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendNotification(@Body() data: SitePriceRequestDto) {
    const payload = {
      ...data,
      phone: normalizePhoneRu(data.phone),
      communicationMethod: data.communicationMethod ?? data.contactMethod,
      carDescription:
        data.carDescription?.trim() ||
        (data.isNotAuto
          ? data.customBrand?.trim()
          : [data.brand, data.model].filter(Boolean).join(" ").trim()) ||
        undefined,
    };

    const result = await this.vkService.sendMessage(payload);
    try {
      await this.leadsService.createFromSiteForm(payload);
    } catch (leadError) {
      console.error("Failed to save site lead:", leadError);
    }
    return {
      statusCode: 200,
      message: "Notification sent successfully",
      data: result,
    };
  }
}
