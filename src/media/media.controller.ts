import {
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ContentAdminGuard } from "./content-admin.guard";
import { MAX_IMAGE_BYTES, MediaService } from "./media.service";
import { AdminThrottle } from "../common/throttle";

@Controller("admin/media")
@AdminThrottle()
@UseGuards(ContentAdminGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post(":folder")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2 },
    }),
  )
  upload(
    @Param("folder") folder: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.media.upload(folder, file);
  }
}
