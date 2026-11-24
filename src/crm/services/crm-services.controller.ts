import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards, UsePipes, ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { AdminThrottle } from "../../common/throttle";
import { CrmServicesService } from "./crm-services.service";
import {
  AddOptionDto, CreateWorkItemDto, DeleteWorkItemQueryDto, UpdateOptionDto, UpdatePricingDto, UpdateWorkItemDto,
} from "./dto/services.dto";

/** Справочник услуг: категории, параметры, значения. */
@Controller("crm/services")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmServiceCatalogController {
  constructor(private readonly services: CrmServicesService) {}

  @Get("catalog")
  catalog(@Query("all") all?: string) {
    return this.services.catalog(all === "1");
  }

  @Post("groups/:groupId/options")
  addOption(@Param("groupId", ParseIntPipe) groupId: number, @Body() dto: AddOptionDto, @Req() req: Request) {
    return this.services.addOption(groupId, dto.name, req);
  }

  @Patch("options/:optionId")
  updateOption(@Param("optionId", ParseIntPipe) optionId: number, @Body() dto: UpdateOptionDto, @Req() req: Request) {
    return this.services.updateOption(optionId, dto, req);
  }
}

/** Перечень согласованных работ и стоимость записи. */
@Controller("crm/appointments/:id")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmWorkItemsController {
  constructor(private readonly services: CrmServicesService) {}

  @Get("works")
  list(@Param("id", ParseIntPipe) id: number) {
    return this.services.listWorks(id);
  }

  @Post("works")
  add(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateWorkItemDto, @Req() req: Request) {
    return this.services.addWork(id, dto, req);
  }

  @Patch("works/:itemId")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() dto: UpdateWorkItemDto,
    @Req() req: Request,
  ) {
    return this.services.updateWork(id, itemId, dto, req);
  }

  @Delete("works/:itemId")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Query() query: DeleteWorkItemQueryDto,
    @Req() req: Request,
  ) {
    return this.services.deleteWork(id, itemId, query.reason, req);
  }

  @Put("pricing")
  pricing(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePricingDto, @Req() req: Request) {
    return this.services.updatePricing(id, dto, req);
  }
}
