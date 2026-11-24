import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Request } from "express";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { AdminThrottle } from "../../common/throttle";
import { CrmStockService } from "./crm-stock.service";
import { CreateStockItemDto, CreateStockMovementDto, MovementsQueryDto, StockQueryDto, UpdateStockItemDto } from "./dto/stock.dto";

@Controller("crm/stock")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmStockController {
  constructor(private readonly stock: CrmStockService) {}

  @Get("items")
  items(@Query() q: StockQueryDto) {
    return this.stock.items(q.location);
  }

  @Post("items")
  createItem(@Body() dto: CreateStockItemDto, @Req() req: Request) {
    return this.stock.createItem(dto, req);
  }

  @Patch("items/:id")
  updateItem(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateStockItemDto, @Req() req: Request) {
    return this.stock.updateItem(id, dto, req);
  }

  @Get("movements")
  movements(@Query() q: MovementsQueryDto) {
    return this.stock.movements(q);
  }

  @Post("movements")
  move(@Body() dto: CreateStockMovementDto, @Req() req: Request) {
    return this.stock.move(dto, req);
  }
}
