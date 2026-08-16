import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { ClientVehiclesService } from "../../client-vehicles/client-vehicles.service";
import { UpsertClientVehicleDto } from "../../client-vehicles/dto/upsert-client-vehicle.dto";

@Controller("crm/clients/:clientId/vehicles")
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmClientVehiclesController {
  constructor(private readonly vehicles: ClientVehiclesService) {}

  @Get()
  list(@Param("clientId", ParseIntPipe) clientId: number) {
    return this.vehicles.listForUser(clientId);
  }

  @Post()
  create(
    @Param("clientId", ParseIntPipe) clientId: number,
    @Body() dto: UpsertClientVehicleDto,
  ) {
    return this.vehicles.create(clientId, dto);
  }

  @Patch(":vehicleId")
  update(
    @Param("clientId", ParseIntPipe) clientId: number,
    @Param("vehicleId", ParseIntPipe) vehicleId: number,
    @Body() dto: UpsertClientVehicleDto,
  ) {
    return this.vehicles.update(clientId, vehicleId, dto);
  }

  @Delete(":vehicleId")
  archive(
    @Param("clientId", ParseIntPipe) clientId: number,
    @Param("vehicleId", ParseIntPipe) vehicleId: number,
  ) {
    return this.vehicles.archive(clientId, vehicleId);
  }
}
