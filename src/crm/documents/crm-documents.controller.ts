import {
  Body, Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Post, Req, UploadedFile, UseGuards, UseInterceptors, UsePipes, ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { DocumentKind } from "../../../generated/prisma/client";
import { AdminJwtGuard } from "../../auth/admin-jwt.guard";
import { AdminThrottle } from "../../common/throttle";
import { MAX_PHOTO_BYTES } from "../../storage/normalize-image";
import { CrmDocumentsService } from "./crm-documents.service";
import { FormDocumentDto, VoidVersionDto } from "./dto/document.dto";

const kindPipe = new ParseEnumPipe(DocumentKind);

/** Договор и акты по записи: номер, версии, снимки, подписание (ТЗ §16–18). */
@Controller("crm/appointments/:id/documents")
@AdminThrottle()
@UseGuards(AdminJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmDocumentsController {
  constructor(private readonly documents: CrmDocumentsService) {}

  @Get()
  list(@Param("id", ParseIntPipe) id: number) {
    return this.documents.list(id);
  }

  @Get("versions/:versionId")
  getVersion(@Param("id", ParseIntPipe) id: number, @Param("versionId", ParseIntPipe) versionId: number) {
    return this.documents.getVersion(id, versionId);
  }

  @Post("versions/:versionId/sign")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  sign(
    @Param("id", ParseIntPipe) id: number,
    @Param("versionId", ParseIntPipe) versionId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    return this.documents.sign(id, versionId, file, req);
  }

  @Post("versions/:versionId/void")
  voidVersion(
    @Param("id", ParseIntPipe) id: number,
    @Param("versionId", ParseIntPipe) versionId: number,
    @Body() dto: VoidVersionDto,
    @Req() req: Request,
  ) {
    return this.documents.voidVersion(id, versionId, dto.reason, req);
  }

  @Get(":kind/draft")
  draft(@Param("id", ParseIntPipe) id: number, @Param("kind", kindPipe) kind: DocumentKind) {
    return this.documents.draft(id, kind);
  }

  @Post(":kind")
  form(
    @Param("id", ParseIntPipe) id: number,
    @Param("kind", kindPipe) kind: DocumentKind,
    @Body() dto: FormDocumentDto,
    @Req() req: Request,
  ) {
    return this.documents.form(id, kind, dto.correction === true, req);
  }
}
