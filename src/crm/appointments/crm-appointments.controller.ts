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
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { CrmAppointmentsService } from "./crm-appointments.service";
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from "./dto/appointment.dto";

@Controller("crm/appointments")
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmAppointmentsController {
  constructor(private readonly appointments: CrmAppointmentsService) {}

  @Get()
  list(@Query("from") from?: string, @Query("to") to?: string) {
    return this.appointments.list(from, to);
  }

  @Post()
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointments.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointments.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.appointments.remove(id);
  }

  @Post(":id/send-review-sms")
  sendReviewSms(@Param("id", ParseIntPipe) id: number) {
    return this.appointments.sendReviewSms(id);
  }
}
