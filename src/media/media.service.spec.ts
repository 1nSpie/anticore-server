import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
const sharp: typeof import("sharp").default = require("sharp");
import { S3Client } from "@aws-sdk/client-s3";
import { MAX_IMAGE_BYTES, MediaService } from "./media.service";

const file = (buffer: Buffer) =>
  ({
    buffer,
    originalname: "../../evil.svg",
    mimetype: "image/jpeg",
  }) as Express.Multer.File;

describe("MediaService", () => {
  const originalEnv = { ...process.env };
  let send: jest.SpyInstance;
  beforeEach(() => {
    process.env.S3_ACCESS_KEY_ID = "test";
    process.env.S3_SECRET_ACCESS_KEY = "test";
    process.env.S3_BUCKET = "test-bucket";
    send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("decodes a photo, normalizes to WebP and writes an immutable unique key", async () => {
    const buffer = await sharp({
      create: { width: 3, height: 2, channels: 3, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const service = new MediaService();
    const first = await service.upload("works", file(buffer));
    const second = await service.upload("works", file(buffer));
    expect(first.key).toMatch(/^works\/[a-f0-9-]+\.webp$/);
    expect(second.key).not.toBe(first.key);
    const input = send.mock.calls[0][0].input;
    expect(input).toMatchObject({
      Bucket: "test-bucket",
      Key: `image/${first.key}`,
      ContentType: "image/webp",
    });
    expect((await sharp(input.Body).metadata()).format).toBe("webp");
  });
  it("rejects missing, oversized and non-image input without writing", async () => {
    const service = new MediaService();
    await expect(service.upload("blog")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.upload("blog", file(Buffer.alloc(MAX_IMAGE_BYTES + 1))),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upload(
        "blog",
        file(
          Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>',
          ),
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upload("blog", file(Buffer.from("not a jpeg"))),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upload("../other", file(Buffer.from("x"))),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
  it("reports missing configuration and hides storage errors", async () => {
    const buffer = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer();
    delete process.env.S3_SECRET_ACCESS_KEY;
    await expect(
      new MediaService().upload("blog", file(buffer)),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    process.env.S3_SECRET_ACCESS_KEY = "test";
    send.mockRejectedValue(new Error("secret details"));
    await expect(
      new MediaService().upload("blog", file(buffer)),
    ).rejects.toThrow("Не удалось загрузить фотографию");
  });
});
