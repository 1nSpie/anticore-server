import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
const sharp: typeof import("sharp").default = require("sharp");

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class MediaService {
  private client?: S3Client;

  async upload(folder: string, file?: Express.Multer.File) {
    if (!["blog", "works"].includes(folder))
      throw new BadRequestException("Неизвестный раздел");
    if (!file?.buffer?.length)
      throw new BadRequestException("Выберите фотографию");
    if (file.buffer.length > MAX_IMAGE_BYTES)
      throw new BadRequestException("Максимальный размер — 10 МБ");

    let body: Buffer;
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 40_000_000,
        failOn: "warning",
      });
      const info = await image.metadata();
      if (
        !["jpeg", "png", "webp"].includes(info.format ?? "") ||
        (info.pages ?? 1) > 1
      ) {
        throw new Error("Unsupported image");
      }
      // Decode and re-encode: reject corrupt files, strip metadata and normalize orientation.
      body = await image
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        "Нужна исправная фотография JPEG, PNG или WebP (до 40 мегапикселей)",
      );
    }
    const { S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET } = process.env;
    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET) {
      throw new ServiceUnavailableException(
        "Загрузка фотографий ещё не настроена",
      );
    }
    this.client ??= new S3Client({
      endpoint:
        process.env.S3_ENDPOINT || "https://s3.ru-3.storage.selcloud.ru",
      region: process.env.S3_REGION || "ru-3",
      forcePathStyle: true,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      maxAttempts: 2,
    });
    const key = `${folder}/${randomUUID()}.webp`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: `image/${key}`,
          Body: body,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
        { abortSignal: AbortSignal.timeout(45_000) },
      );
    } catch {
      throw new ServiceUnavailableException(
        "Не удалось загрузить фотографию. Попробуйте ещё раз",
      );
    }
    return { key };
  }
}
