import { BadRequestException } from "@nestjs/common";
const sharp: typeof import("sharp").default = require("sharp");

/** Максимальный размер загружаемого файла (фото с телефона бывает 8–12 МБ). */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/**
 * Принимает JPEG/PNG/WebP, полностью перекодирует в WebP: битые и «замаскированные» файлы отсеиваются,
 * метаданные (в том числе GPS из EXIF) удаляются, ориентация нормализуется, размер ограничивается 2400 px.
 */
export async function normalizePhoto(input?: Buffer): Promise<{ data: Buffer; contentType: "image/webp"; ext: "webp" }> {
  if (!input?.length) throw new BadRequestException("Выберите фотографию");
  if (input.length > MAX_PHOTO_BYTES) throw new BadRequestException("Максимальный размер фото — 15 МБ");
  try {
    const image = sharp(input, { limitInputPixels: 60_000_000, failOn: "warning" });
    const info = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(info.format ?? "") || (info.pages ?? 1) > 1) throw new Error("unsupported");
    const data = await image
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { data, contentType: "image/webp", ext: "webp" };
  } catch {
    throw new BadRequestException("Нужна исправная фотография JPEG, PNG или WebP");
  }
}
