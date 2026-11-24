import { Body, Controller, Get, Param, Put, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { AdminThrottle } from "../../common/throttle";
import { CrmOrganizationService } from "./crm-organization.service";
import { UpdateBranchDto, UpdateOrganizationDto } from "./dto/organization.dto";

@Controller("crm/settings")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmOrganizationController {
  constructor(private readonly organization: CrmOrganizationService) {}

  /** Реквизиты ИП и все филиалы одним ответом — для формирования документов. */
  @Get("organization")
  get() {
    return this.organization.get();
  }

  @Put("organization")
  update(@Body() dto: UpdateOrganizationDto) {
    return this.organization.updateOrganization(dto);
  }

  @Put("branches/:location")
  updateBranch(@Param("location") location: string, @Body() dto: UpdateBranchDto) {
    return this.organization.updateBranch(location, dto);
  }
}
