import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { SiteLeadStatus } from "../../../generated/prisma/client";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { CrmLeadsService } from "./crm-leads.service";
import { ScheduleLeadDto, UpdateSiteLeadDto } from "./dto/site-lead.dto";

@Controller("crm/leads")
@UseGuards(AdminJwtGuard)
export class CrmLeadsController {
  constructor(private readonly leads: CrmLeadsService) {}

  @Get()
  list(@Query("status") status?: SiteLeadStatus) {
    return this.leads.list(status);
  }

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.leads.get(id);
  }

  @Patch(":id")
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSiteLeadDto,
  ) {
    return this.leads.update(id, dto);
  }

  @Post(":id/schedule")
  schedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ScheduleLeadDto,
  ) {
    return this.leads.linkToVisit(id, dto.visitId);
  }
}
