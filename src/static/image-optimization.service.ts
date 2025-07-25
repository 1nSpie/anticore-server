import { Injectable, Logger } from "@nestjs/common";
import * as sharp from "sharp";
import { existsSync } from "fs";

export interface ImageOptimizationOptions {
  width?: number;
  quality?: number;
  format?: string;
}

export interface OptimizedImageResult {
  buffer: Buffer;
  format: string;
  fromCache: boolean;
}

@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);
  private readonly imageCache = new Map<string, Buffer>();
  private readonly MAX_CACHE_SIZE = 200; // Increased cache size
  private readonly MAX_WIDTH = 3840; // 4K width limit
  private readonly DEFAULT_QUALITY = 85;

  async optimizeImage(
    filePath: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImageResult> {
    if (!existsSync(filePath)) {
      throw new Error(`Image file not found: ${filePath}`);
    }

    const {
      width: targetWidth,
      quality: targetQuality = this.DEFAULT_QUALITY,
      format: targetFormat,
    } = options;

    // Determine optimal format
    const finalFormat = targetFormat || this.getOptimalFormat(filePath);
    const finalQuality = Math.min(Math.max(targetQuality, 1), 100);

    // Create cache key
    const cacheKey = `${filePath}_w${targetWidth}_q${finalQuality}_${finalFormat}`;

    // Check cache first
    if (this.imageCache.has(cacheKey)) {
      return {
        buffer: this.imageCache.get(cacheKey)!,
        format: finalFormat,
        fromCache: true,
      };
    }

    try {
      // Check if optimization is needed
      if (!targetWidth && !options.quality && !options.format) {
        // For SVG files, return as-is
        if (this.getFileExtension(filePath) === "svg") {
          const fs = await import("fs/promises");
          const buffer = await fs.readFile(filePath);
          return {
            buffer,
            format: "svg",
            fromCache: false,
          };
        }
      }

      // Apply image optimization with Sharp
      let sharpInstance = sharp(filePath);

      // Get original image metadata
      const metadata = await sharpInstance.metadata();

      // Apply width transformation if specified
      if (targetWidth && targetWidth > 0 && targetWidth <= this.MAX_WIDTH) {
        // Don't enlarge images
        const resizeWidth = Math.min(
          targetWidth,
          metadata.width || targetWidth
        );
        sharpInstance = sharpInstance.resize(resizeWidth, null, {
          withoutEnlargement: true,
          fit: "inside",
        });
      }

      // Apply format and quality transformations
      switch (finalFormat.toLowerCase()) {
        case "webp":
          sharpInstance = sharpInstance.webp({
            quality: finalQuality,
            effort: 4, // Balance between compression and speed
          });
          break;
        case "avif":
          sharpInstance = sharpInstance.avif({
            quality: finalQuality,
            effort: 4,
          });
          break;
        case "jpeg":
        case "jpg":
          sharpInstance = sharpInstance.jpeg({
            quality: finalQuality,
            progressive: true,
            mozjpeg: true, // Better compression
          });
          break;
        case "png":
          sharpInstance = sharpInstance.png({
            quality: finalQuality,
            progressive: true,
            compressionLevel: 9,
          });
          break;
        default:
          // Keep original format with quality adjustment
          if (metadata.format === "jpeg") {
            sharpInstance = sharpInstance.jpeg({
              quality: finalQuality,
              progressive: true,
            });
          } else if (metadata.format === "png") {
            sharpInstance = sharpInstance.png({
              quality: finalQuality,
              progressive: true,
            });
          }
          break;
      }

      const optimizedBuffer = await sharpInstance.toBuffer();

      // Cache the optimized image (with LRU-like behavior)
      this.cacheImage(cacheKey, optimizedBuffer);

      this.logger.log(
        `Optimized image: ${filePath} (${metadata.width}x${metadata.height}) -> ${finalFormat} q${finalQuality}`
      );

      return {
        buffer: optimizedBuffer,
        format: finalFormat,
        fromCache: false,
      };
    } catch (error) {
      this.logger.error(`Error optimizing image ${filePath}:`, error.message);
      throw error;
    }
  }

  private cacheImage(key: string, buffer: Buffer) {
    // Implement LRU cache behavior
    if (this.imageCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries (first 10%)
      const keysToRemove = Array.from(this.imageCache.keys()).slice(
        0,
        Math.floor(this.MAX_CACHE_SIZE * 0.1)
      );
      keysToRemove.forEach((key) => this.imageCache.delete(key));
    }
    this.imageCache.set(key, buffer);
  }

  getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      avif: "image/avif",
      gif: "image/gif",
      svg: "image/svg+xml",
    };

    return mimeTypes[format.toLowerCase()] || "image/jpeg";
  }

  private getFileExtension(filePath: string): string {
    return filePath.split(".").pop()?.toLowerCase() || "jpg";
  }

  private getOptimalFormat(filePath: string): string {
    const extension = this.getFileExtension(filePath);

    // Return optimal format based on original
    switch (extension) {
      case "svg":
        return "svg"; // Keep SVG as is
      case "gif":
        return "gif"; // Keep GIF to preserve animation
      case "png":
        return "webp"; // Convert PNG to WebP for better compression
      case "jpg":
      case "jpeg":
        return "webp"; // Convert JPEG to WebP for better compression
      default:
        return "webp"; // Default to WebP for best compression
    }
  }

  getCacheStats() {
    return {
      cacheSize: this.imageCache.size,
      maxCacheSize: this.MAX_CACHE_SIZE,
      cacheKeys: Array.from(this.imageCache.keys()),
    };
  }

  clearCache() {
    this.imageCache.clear();
    this.logger.log("Image cache cleared");
  }
}
