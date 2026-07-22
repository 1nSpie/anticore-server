import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { clientIpFromRequest } from "../../cabinet/common/client-ip.util";
import { CrmClientsService } from "./crm-clients.service";
import {
  CreateCrmClientDto,
  CrmBroadcastSmsDto,
  ListCrmClientsQueryDto,
  UpdateCrmClientDto,
} from "./dto/crm-client.dto";

@Controller("crm/clients")
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmClientsController {
  constructor(private readonly clients: CrmClientsService) {}

  @Get()
  list(@Query() query: ListCrmClientsQueryDto) {
    return this.clients.list(query);
  }

  @Post("broadcast")
  broadcast(@Req() req: Request, @Body() dto: CrmBroadcastSmsDto) {
    return this.clients.broadcast(dto, clientIpFromRequest(req));
  }

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.clients.get(id);
  }

  @Post()
  create(@Body() dto: CreateCrmClientDto) {
    return this.clients.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCrmClientDto,
  ) {
    return this.clients.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.clients.remove(id);
  }

  @Post(":id/send-review-sms")
  sendReview(@Param("id", ParseIntPipe) id: number) {
    return this.clients.sendReviewNow(id);
  }
}
