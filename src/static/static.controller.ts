import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Query,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { join } from "path";
import { existsSync, readdirSync, statSync } from "fs";
import { ImageOptimizationService } from "./image-optimization.service";

@Controller("static")
export class StaticController {
  private readonly logger = new Logger(StaticController.name);
  private readonly publicPath = join(process.cwd(), "public");

  constructor(
    private readonly imageOptimizationService: ImageOptimizationService
  ) {}

  @Get("images/:folder")
  getImagesList(@Param("folder") folder: string) {
    const folderPath = join(this.publicPath, folder);

    if (!existsSync(folderPath)) {
      throw new NotFoundException(`Folder ${folder} not found`);
    }

    try {
      const files = readdirSync(folderPath)
        .filter((file) => {
          const filePath = join(folderPath, file);
          return (
            statSync(filePath).isFile() &&
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)
          );
        })
        .map((file) => ({
          name: file,
          url: `/static/images/${folder}/${file}`,
          fullUrl: `${process.env.BACKEND_BASE_URL || "http://localhost:4444"}/static/images/${folder}/${file}`,
        }));

      return {
        folder,
        count: files.length,
        images: files,
      };
    } catch (error) {
      throw new NotFoundException(`Error reading folder ${folder}`);
    }
  }

  @Get("images/:folder/:filename")
  async serveImage(
    @Param("folder") folder: string,
    @Param("filename") filename: string,
    @Res() res: Response,
    @Query("w") width?: string,
    @Query("q") quality?: string,
    @Query("fm") format?: string
  ) {
    const filePath = join(this.publicPath, folder, filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`Image ${folder}/${filename} not found`);
    }

    try {
      // Parse query parameters
      const targetWidth = width ? parseInt(width, 10) : undefined;
      const targetQuality = quality ? parseInt(quality, 10) : undefined;

      // Use the image optimization service
      const result = await this.imageOptimizationService.optimizeImage(
        filePath,
        {
          width: targetWidth,
          quality: targetQuality,
          format: format,
        }
      );

      // Set appropriate headers
      this.setImageHeaders(res, result.format, result.fromCache);

      return res.send(result.buffer);
    } catch (error) {
      this.logger.error(
        `Error processing image ${folder}/${filename}:`,
        error.message
      );

      // Fallback to original file if optimization fails
      try {
        const fileExtension = this.getFileExtension(filename);
        this.setImageHeaders(res, fileExtension, false);
        return res.sendFile(filePath);
      } catch (fallbackError) {
        throw new NotFoundException(
          `Unable to serve image ${folder}/${filename}`
        );
      }
    }
  }

  @Get("cache/stats")
  getCacheStats() {
    return this.imageOptimizationService.getCacheStats();
  }

  @Get("cache/clear")
  clearCache() {
    this.imageOptimizationService.clearCache();
    return { message: "Image cache cleared successfully" };
  }

  private setImageHeaders(
    res: Response,
    format: string,
    fromCache: boolean = false
  ) {
    const mimeType = this.imageOptimizationService.getMimeType(format);

    res.set({
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable", // 1 year cache
      ETag: `"${Date.now()}"`,
      Vary: "Accept",
      "X-Image-Cache": fromCache ? "HIT" : "MISS",
    });
  }

  private getFileExtension(filename: string): string {
    return filename.split(".").pop()?.toLowerCase() || "jpg";
  }
}
