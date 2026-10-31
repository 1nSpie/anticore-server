import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Request } from "express";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { ScheduleQueryDto, SetAssigneesDto } from "./dto/assign.dto";
import { Roles } from "./roles.decorator";
import { StaffAssignmentsService } from "./staff-assignments.service";
import { StaffJwtGuard, StaffPrincipal } from "./staff-jwt.guard";
import { AdminThrottle, StaffThrottle } from "../common/throttle";

/** Расписание мастера: только свои записи, без данных клиента. */
@Controller("staff/schedule")
@StaffThrottle()
@UseGuards(StaffJwtGuard)
@Roles("MASTER")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StaffScheduleController {
  constructor(private readonly assignments: StaffAssignmentsService) {}

  @Get()
  mine(@Req() req: Request, @Query() q: ScheduleQueryDto) {
    return this.assignments.scheduleFor((req["staff"] as StaffPrincipal).id, q.from, q.to);
  }
}

/** Назначение мастеров на запись — только админка. */
@Controller("crm/appointments")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AppointmentAssigneesController {
  constructor(private readonly assignments: StaffAssignmentsService) {}

  @Put(":id/staff")
  setStaff(@Param("id", ParseIntPipe) id: number, @Body() dto: SetAssigneesDto, @Req() req: Request) {
    return this.assignments.setAssignees(id, dto.staffIds, req);
  }
}
