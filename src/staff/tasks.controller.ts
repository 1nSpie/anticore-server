import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { MAX_PHOTO_BYTES } from "../storage/normalize-image";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { CreateTaskDto, TaskCommentDto, TaskListQueryDto, UpdateTaskDto } from "./dto/task.dto";
import { Roles } from "./roles.decorator";
import { StaffJwtGuard, StaffPrincipal } from "./staff-jwt.guard";
import { TasksService } from "./tasks.service";
import { AdminThrottle, StaffThrottle } from "../common/throttle";

const pipe = new ValidationPipe({ transform: true, whitelist: true });

/** Задачи мастера: только свои. Создать задачу мастер не может. */
@Controller("staff/tasks")
@StaffThrottle()
@UseGuards(StaffJwtGuard)
@Roles("MASTER")
@UsePipes(pipe)
export class StaffTasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  mine(@Req() req: Request) {
    return this.tasks.listForMaster((req["staff"] as StaffPrincipal).id);
  }

  @Post(":id/start")
  @HttpCode(200)
  start(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    return this.tasks.start((req["staff"] as StaffPrincipal).id, id);
  }

  /** Фото к своей задаче (поле `file`). Хранится в приватном хранилище, наружу — только подписанная ссылка. */
  @Post(":id/photos")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  addPhoto(@Req() req: Request, @Param("id", ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    const staff = req["staff"] as StaffPrincipal;
    return this.tasks.addPhotoAsMaster(staff.id, staff.login, id, file, req);
  }

  @Delete(":id/photos/:photoId")
  deletePhoto(@Req() req: Request, @Param("id", ParseIntPipe) id: number, @Param("photoId", ParseIntPipe) photoId: number) {
    const staff = req["staff"] as StaffPrincipal;
    return this.tasks.deletePhotoAsMaster(staff.id, staff.login, id, photoId, req);
  }

  @Post(":id/complete")
  @HttpCode(200)
  complete(@Req() req: Request, @Param("id", ParseIntPipe) id: number, @Body() dto: TaskCommentDto) {
    const staff = req["staff"] as StaffPrincipal;
    return this.tasks.complete(staff.id, id, dto.comment, staff.login, req);
  }
}

/** Задачи в админке: создание, подтверждение, возврат, отмена. */
@Controller("crm/tasks")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(pipe)
export class CrmTasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Query() q: TaskListQueryDto) {
    return this.tasks.list(q);
  }

  @Post()
  create(@Body() dto: CreateTaskDto, @Req() req: Request) {
    return this.tasks.create(dto, req);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateTaskDto, @Req() req: Request) {
    return this.tasks.update(id, dto, req);
  }

  @Post(":id/confirm")
  @HttpCode(200)
  confirm(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    return this.tasks.confirm(id, req);
  }

  @Post(":id/return")
  @HttpCode(200)
  returnToWork(@Param("id", ParseIntPipe) id: number, @Body() dto: TaskCommentDto, @Req() req: Request) {
    return this.tasks.returnToWork(id, dto.comment, req);
  }

  @Post(":id/photos")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  addPhoto(@Param("id", ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    return this.tasks.addPhotoAsAdmin(id, file, req);
  }

  @Delete(":id/photos/:photoId")
  deletePhoto(@Param("id", ParseIntPipe) id: number, @Param("photoId", ParseIntPipe) photoId: number, @Req() req: Request) {
    return this.tasks.deletePhotoAsAdmin(id, photoId, req);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    return this.tasks.cancel(id, req);
  }
}
