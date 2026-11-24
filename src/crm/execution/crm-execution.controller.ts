import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors, UsePipes, ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { AdminThrottle } from "../../common/throttle";
import { MAX_PHOTO_BYTES } from "../../storage/normalize-image";
import { CrmExecutionService } from "./crm-execution.service";
import {
  CreateExtraDto, DecideExtraDto, UpdateExecutionDto, UpdateExtraDto, UpdateHandoverDto, WorkPhotoDto,
} from "./dto/execution.dto";

/** Выполнение работ, допработы и выдача автомобиля по записи. */
@Controller("crm/appointments/:id")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmExecutionController {
  constructor(private readonly execution: CrmExecutionService) {}

  @Get("execution")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.execution.get(id);
  }

  @Patch("execution/items/:itemId")
  updateItem(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() dto: UpdateExecutionDto,
    @Req() req: Request,
  ) {
    return this.execution.updateItem(id, itemId, dto, req);
  }

  @Post("execution/extras")
  addExtra(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateExtraDto, @Req() req: Request) {
    return this.execution.addExtra(id, dto, req);
  }

  @Patch("execution/extras/:itemId")
  updateExtra(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() dto: UpdateExtraDto,
    @Req() req: Request,
  ) {
    return this.execution.updateExtra(id, itemId, dto, req);
  }

  @Post("execution/extras/:itemId/decision")
  decide(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() dto: DecideExtraDto,
    @Req() req: Request,
  ) {
    return this.execution.decideExtra(id, itemId, dto, req);
  }

  @Delete("execution/extras/:itemId")
  deleteExtra(@Param("id", ParseIntPipe) id: number, @Param("itemId", ParseIntPipe) itemId: number, @Req() req: Request) {
    return this.execution.deleteExtra(id, itemId, req);
  }

  @Post("execution/items/:itemId/photos")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  addPhoto(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() body: WorkPhotoDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.execution.addPhoto(id, itemId, body.stage, file, req);
  }

  @Delete("execution/items/:itemId/photos/:photoId")
  deletePhoto(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Param("photoId", ParseIntPipe) photoId: number,
    @Req() req: Request,
  ) {
    return this.execution.deletePhoto(id, itemId, photoId, req);
  }

  @Get("handover")
  getHandover(@Param("id", ParseIntPipe) id: number) {
    return this.execution.getHandover(id);
  }

  @Put("handover")
  updateHandover(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateHandoverDto, @Req() req: Request) {
    return this.execution.updateHandover(id, dto, req);
  }
}
