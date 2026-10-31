import { BadRequestException } from "@nestjs/common";
import { MAX_PHOTO_BYTES, normalizePhoto } from "./normalize-image";

const sharp = require("sharp");
const make = (w: number, h: number, fmt: "png" | "jpeg" | "webp" | "gif" = "png") =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#aa5522" } })[fmt]().toBuffer() as Promise<Buffer>;

describe("normalizePhoto", () => {
  it("JPEG, PNG и WebP принимаются и становятся WebP", async () => {
    for (const fmt of ["png", "jpeg", "webp"] as const) {
      const r = await normalizePhoto(await make(100, 80, fmt));
      expect(r.contentType).toBe("image/webp");
      expect((await sharp(r.data).metadata()).format).toBe("webp");
    }
  });

  it("большое фото уменьшается до 2400 px по большей стороне, маленькое не растягивается", async () => {
    const big = await sharp(await normalizePhoto(await make(4000, 3000)).then((r) => r.data)).metadata();
    expect(Math.max(big.width, big.height)).toBe(2400);
    const small = await sharp((await normalizePhoto(await make(100, 50))).data).metadata();
    expect([small.width, small.height]).toEqual([100, 50]);
  });

  it("метаданные EXIF (в том числе GPS) вырезаются", async () => {
    const withExif = await sharp(await make(80, 60, "jpeg")).withExif({ IFD0: { Copyright: "secret-gps-marker" } }).jpeg().toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await normalizePhoto(withExif);
    expect((await sharp(out.data).metadata()).exif).toBeUndefined();
    expect(out.data.includes(Buffer.from("secret-gps-marker"))).toBe(false);
  });

  it("не картинка, GIF, пустой и подделка под картинку — 400", async () => {
    await expect(normalizePhoto(Buffer.from("MZ\x90\x00 exe"))).rejects.toBeInstanceOf(BadRequestException);
    await expect(normalizePhoto(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).rejects.toBeInstanceOf(BadRequestException);
    await expect(normalizePhoto(await make(10, 10, "gif").catch(() => Buffer.from("GIF89a")))).rejects.toBeInstanceOf(BadRequestException);
    await expect(normalizePhoto(undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(normalizePhoto(Buffer.alloc(0))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("файл больше 15 МБ отклоняется без декодирования", async () => {
    await expect(normalizePhoto(Buffer.alloc(MAX_PHOTO_BYTES + 1))).rejects.toThrow("15 МБ");
  });
});
