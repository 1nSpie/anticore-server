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
  StreamableFile,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import {
  AckDto,
  CreateArticleDto,
  CreateSectionDto,
  PublishDto,
  SearchQueryDto,
  UpdateArticleDto,
  UpdateSectionDto,
} from "./dto/regulation.dto";
import { AllowWithoutRegulationAck } from "./regulation-ack.decorator";
import { MAX_PDF_BYTES, RegulationService } from "./regulation.service";
import { Roles } from "./roles.decorator";
import { StaffJwtGuard, StaffPrincipal } from "./staff-jwt.guard";
import { AdminThrottle, StaffThrottle } from "../common/throttle";

const pipe = new ValidationPipe({ transform: true, whitelist: true });

async function sendPdf(service: RegulationService, id: number, res: Response) {
  const a = await service.attachment(id);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=0, must-revalidate",
  });
  return new StreamableFile(Buffer.from(a.data));
}

/** Регламент для мастера: чтение, поиск и ознакомление. Доступен и без подтверждения регламента — иначе его не прочитать. */
@Controller("staff/regulation")
@StaffThrottle()
@UseGuards(StaffJwtGuard)
@Roles("MASTER")
@AllowWithoutRegulationAck()
@UsePipes(pipe)
export class StaffRegulationController {
  constructor(private readonly regulation: RegulationService) {}

  @Get()
  tree() {
    return this.regulation.tree();
  }

  @Get("status")
  status(@Req() req: Request) {
    return this.regulation.statusFor((req["staff"] as StaffPrincipal).id);
  }

  @Get("search")
  search(@Query() q: SearchQueryDto) {
    return this.regulation.search(q.q);
  }

  @Get("articles/:id")
  article(@Param("id", ParseIntPipe) id: number) {
    return this.regulation.article(id);
  }

  @Get("attachments/:id")
  attachment(@Param("id", ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response) {
    return sendPdf(this.regulation, id, res);
  }

  @Post("ack")
  @HttpCode(200)
  ack(@Req() req: Request, @Body() dto: AckDto) {
    const staff = req["staff"] as StaffPrincipal;
    return this.regulation.ack(staff.id, staff.login, dto.version, req);
  }
}

/** Редактор регламента в админке. */
@Controller("crm/regulation")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(pipe)
export class CrmRegulationController {
  constructor(private readonly regulation: RegulationService) {}

  @Get()
  tree() {
    return this.regulation.tree();
  }

  @Get("state")
  state() {
    return this.regulation.state();
  }

  @Post("publish")
  @HttpCode(200)
  publish(@Body() dto: PublishDto, @Req() req: Request) {
    return this.regulation.publish(dto.note, req);
  }

  @Post("sections")
  createSection(@Body() dto: CreateSectionDto, @Req() req: Request) {
    return this.regulation.createSection(dto, req);
  }

  @Patch("sections/:id")
  updateSection(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSectionDto, @Req() req: Request) {
    return this.regulation.updateSection(id, dto, req);
  }

  @Delete("sections/:id")
  deleteSection(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    return this.regulation.deleteSection(id, req);
  }

  @Post("articles")
  createArticle(@Body() dto: CreateArticleDto, @Req() req: Request) {
    return this.regulation.createArticle(dto, req);
  }

  @Get("articles/:id")
  article(@Param("id", ParseIntPipe) id: number) {
    return this.regulation.article(id);
  }

  @Patch("articles/:id")
  updateArticle(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateArticleDto, @Req() req: Request) {
    return this.regulation.updateArticle(id, dto, req);
  }

  @Delete("articles/:id")
  deleteArticle(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    return this.regulation.deleteArticle(id, req);
  }

  @Post("articles/:id/attachments")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PDF_BYTES, files: 1 } }))
  addAttachment(@Param("id", ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    return this.regulation.addAttachment(id, file, req);
  }

  @Get("attachments/:id")
  attachment(@Param("id", ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response) {
    return sendPdf(this.regulation, id, res);
  }

  @Delete("attachments/:id")
  deleteAttachment(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    return this.regulation.deleteAttachment(id, req);
  }
}
