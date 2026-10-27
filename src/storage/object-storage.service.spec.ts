import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ServiceUnavailableException } from "@nestjs/common";
import { ObjectStorageService } from "./object-storage.service";

const ENV_KEYS = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT", "S3_REGION", "S3_PUBLIC_URL", "S3_FILES_PREFIX"];

describe("ObjectStorageService", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  });
  afterEach(() => {
    ENV_KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  });

  const configure = () => {
    process.env.S3_BUCKET = "site-bucket";
    process.env.S3_ACCESS_KEY_ID = "AKIATEST";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    process.env.S3_PUBLIC_URL = "https://abc123.selstorage.ru";
    process.env.S3_ENDPOINT = "http://127.0.0.1:9";
  };

  it("без бакета, ключей или публичного адреса хранилище «не настроено»: загрузка → 503, ссылки нет, удаление молча пропускается", async () => {
    const s = new ObjectStorageService();
    expect(s.isConfigured()).toBe(false);
    await expect(s.put("a/b.webp", Buffer.from("x"), "image/webp")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(s.publicUrl("a/b.webp")).toBeNull();
    await expect(s.remove("a/b.webp")).resolves.toBeUndefined();
  });

  it("нужны все три части: бакет, ключи и публичный адрес — иначе ссылки были бы битыми", () => {
    process.env.S3_BUCKET = "site-bucket";
    process.env.S3_ACCESS_KEY_ID = "AKIATEST";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    expect(new ObjectStorageService().isConfigured()).toBe(false); // нет S3_PUBLIC_URL
    process.env.S3_PUBLIC_URL = "https://abc123.selstorage.ru";
    expect(new ObjectStorageService().isConfigured()).toBe(true);
  });

  it("ссылка: публичный адрес + папка + ключ; по умолчанию папка admin", () => {
    configure();
    expect(new ObjectStorageService().publicUrl("tasks/5/a.webp")).toBe("https://abc123.selstorage.ru/admin/tasks/5/a.webp");
  });

  it("папку можно переопределить, лишние слэши в адресе, папке и ключе убираются", () => {
    configure();
    process.env.S3_PUBLIC_URL = "https://abc123.selstorage.ru//";
    process.env.S3_FILES_PREFIX = "/admin-uploads/";
    expect(new ObjectStorageService().publicUrl("/tasks/5/a.webp")).toBe("https://abc123.selstorage.ru/admin-uploads/tasks/5/a.webp");
  });

  it("секретный ключ никогда не попадает в ссылку", () => {
    configure();
    const url = new ObjectStorageService().publicUrl("tasks/5/a.webp")!;
    expect(url).not.toContain("secret");
    expect(url).not.toContain("AKIATEST");
    expect(url).not.toContain("?"); // без подписи и query — это обычная публичная ссылка
  });

  it("недоступное хранилище при загрузке → 503 с понятным текстом, без утечки деталей", async () => {
    configure();
    const err: any = await new ObjectStorageService().put("tasks/5/a.webp", Buffer.from("x"), "image/webp").catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(String(err.message)).toBe("Не удалось сохранить файл. Попробуйте ещё раз");
  }, 60_000);

  it("сбой удаления не пробрасывается: сиротский объект лучше, чем сорванная операция", async () => {
    configure();
    await expect(new ObjectStorageService().remove("tasks/5/a.webp")).resolves.toBeUndefined();
  }, 60_000);

  describe("загрузка в хранилище", () => {
    let send: jest.SpyInstance;
    beforeEach(() => {
      send = jest.spyOn(S3Client.prototype as any, "send").mockResolvedValue({} as never);
    });
    afterEach(() => send.mockRestore());

    it("файл уходит в бакет сайта, в папку admin/, с типом WebP и коротким публичным кэшем", async () => {
      configure();
      const body = Buffer.from("webp-bytes");
      await new ObjectStorageService().put("tasks/5/a.webp", body, "image/webp");

      expect(send).toHaveBeenCalledTimes(1);
      const cmd = send.mock.calls[0][0];
      expect(cmd).toBeInstanceOf(PutObjectCommand);
      expect(cmd.input).toEqual({
        Bucket: "site-bucket",
        Key: "admin/tasks/5/a.webp",
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=3600",
      });
    });

    it("удаление берёт тот же ключ в папке admin/", async () => {
      configure();
      await new ObjectStorageService().remove("tasks/5/a.webp");
      const cmd = send.mock.calls[0][0];
      expect(cmd).toBeInstanceOf(DeleteObjectCommand);
      expect(cmd.input).toEqual({ Bucket: "site-bucket", Key: "admin/tasks/5/a.webp" });
    });

    it("папка переопределяется через S3_FILES_PREFIX, слэши по краям не мешают", async () => {
      configure();
      process.env.S3_FILES_PREFIX = "/staff-files/";
      await new ObjectStorageService().put("tasks/5/a.webp", Buffer.from("x"), "image/webp");
      expect(send.mock.calls[0][0].input.Key).toBe("staff-files/tasks/5/a.webp");
    });

    it("ключ не может выйти из папки: .. и обратный слэш отклоняются, в S3 ничего не уходит", async () => {
      configure();
      const s = new ObjectStorageService();
      for (const bad of ["../image/blog/x.jpg", "tasks/../../x.webp", "tasks\\5\\a.webp"]) {
        await expect(s.put(bad, Buffer.from("x"), "image/webp")).rejects.toThrow();
        expect(s.publicUrl.bind(s, bad)).toThrow();
      }
      expect(send).not.toHaveBeenCalled();
    });

    it("загрузка идёт на эндпоинт и с регионом из настроек, ключи берутся из окружения", async () => {
      configure();
      process.env.S3_REGION = "ru-9";
      const s = new ObjectStorageService();
      await s.put("tasks/5/a.webp", Buffer.from("x"), "image/webp");
      const client: S3Client = send.mock.instances[0];
      expect(await client.config.region()).toBe("ru-9");
      expect((await client.config.credentials()).accessKeyId).toBe("AKIATEST");
      expect(String((await client.config.endpoint?.())?.hostname)).toBe("127.0.0.1");
    });
  });
});
