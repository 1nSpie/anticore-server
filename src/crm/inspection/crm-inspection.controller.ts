import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors, UsePipes, ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsIn, IsInt, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { Request } from "express";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { AdminThrottle } from "../../common/throttle";
import { MAX_PHOTO_BYTES } from "../../storage/normalize-image";
import { CrmInspectionService } from "./crm-inspection.service";
import { CreateMarkDto, UpdateInspectionDto, UpdateMarkDto } from "./dto/inspection.dto";

class UploadPhotoDto {
  @IsOptional() @IsIn(["GENERAL", "EXTERIOR", "INTERIOR"]) section?: "GENERAL" | "EXTERIOR" | "INTERIOR";
  @IsOptional() @Type(() => Number) @IsInt() markId?: number;
}

/** Приёмка автомобиля по записи. Пока доступна админке/CRM; кабинет мастера — отдельное решение (ПДн клиента). */
@Controller("crm/appointments/:id/inspection")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmInspectionController {
  constructor(private readonly inspection: CrmInspectionService) {}

  @Get()
  get(@Param("id", ParseIntPipe) id: number) {
    return this.inspection.get(id);
  }

  @Post("start")
  start(@Param("id", ParseIntPipe) id: number) {
    return this.inspection.start(id);
  }

  @Patch()
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateInspectionDto, @Req() req: Request) {
    return this.inspection.update(id, dto, req);
  }

  @Post("verify")
  verify(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    return this.inspection.verify(id, req);
  }

  @Post("marks")
  addMark(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateMarkDto) {
    return this.inspection.addMark(id, dto);
  }

  @Patch("marks/:markId")
  updateMark(@Param("id", ParseIntPipe) id: number, @Param("markId", ParseIntPipe) markId: number, @Body() dto: UpdateMarkDto) {
    return this.inspection.updateMark(id, markId, dto);
  }

  @Delete("marks/:markId")
  deleteMark(@Param("id", ParseIntPipe) id: number, @Param("markId", ParseIntPipe) markId: number) {
    return this.inspection.deleteMark(id, markId);
  }

  @Post("photos")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  addPhoto(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadPhotoDto,
    @Req() req: Request,
  ) {
    return this.inspection.addPhoto(id, file, body, req);
  }

  @Delete("photos/:photoId")
  deletePhoto(@Param("id", ParseIntPipe) id: number, @Param("photoId", ParseIntPipe) photoId: number, @Req() req: Request) {
    return this.inspection.deletePhoto(id, photoId, req);
  }
}
