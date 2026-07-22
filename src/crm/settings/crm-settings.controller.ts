import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { CrmSettingsService } from "./crm-settings.service";
import {
  UpdateServiceTypesDto,
  UpdateSmsTemplatesDto,
} from "./dto/crm-settings.dto";

@Controller("crm/settings")
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmSettingsController {
  constructor(private readonly settings: CrmSettingsService) {}

  @Get("service-types")
  getServiceTypes() {
    return this.settings.getServiceTypes();
  }

  @Put("service-types")
  updateServiceTypes(@Body() dto: UpdateServiceTypesDto) {
    return this.settings.updateServiceTypes(dto);
  }

  @Delete("service-types/:id")
  deleteServiceType(@Param("id", ParseIntPipe) id: number) {
    return this.settings.deleteServiceType(id);
  }

  @Get("sms-templates")
  getSmsTemplates() {
    return this.settings.getSmsTemplates();
  }

  @Put("sms-templates")
  updateSmsTemplates(@Body() dto: UpdateSmsTemplatesDto) {
    return this.settings.updateSmsTemplates(dto);
  }
}
