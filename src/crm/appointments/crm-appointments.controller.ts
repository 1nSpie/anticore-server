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
  CompleteAppointmentDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from "./dto/appointment.dto";

@Controller("crm/appointments")
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmAppointmentsController {
  constructor(private readonly appointments: CrmAppointmentsService) {}

  @Get()
  list(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("location") location?: string,
  ) {
    return this.appointments.list(from, to, location);
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

  /** Закрыть запись (работы выполнены) — связанная заявка → «Выполнена». */
  @Post(":id/complete")
  complete(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CompleteAppointmentDto,
  ) {
    return this.appointments.complete(id, dto);
  }

  /** Отменить закрытие записи. */
  @Post(":id/reopen")
  reopen(@Param("id", ParseIntPipe) id: number) {
    return this.appointments.reopen(id);
  }

  @Post(":id/send-review-sms")
  sendReviewSms(@Param("id", ParseIntPipe) id: number) {
    return this.appointments.sendReviewSms(id);
  }
}
