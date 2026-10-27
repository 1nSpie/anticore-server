import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ServiceUnavailableException } from "@nestjs/common";
import { TasksService } from "../staff/tasks.service";
import { ObjectStorageService } from "./object-storage.service";

/**
 * Сквозной сценарий загрузки фото к задаче: настоящие TasksService, нормализация (sharp) и ObjectStorageService,
 * подменён только сетевой вызов S3 и база. Проверяем, что реально уходит в Selectel и что ссылка указывает на тот же объект.
 */
const ENV = { S3_BUCKET: "site-bucket", S3_ACCESS_KEY_ID: "AKIATEST", S3_SECRET_ACCESS_KEY: "secret", S3_PUBLIC_URL: "https://abc123.selstorage.ru/", S3_ENDPOINT: "http://127.0.0.1:9" };
const KEYS = [...Object.keys(ENV), "S3_FILES_PREFIX"];

describe("загрузка фото к задаче → папка admin/ в хранилище", () => {
  const saved: Record<string, string | undefined> = {};
  let send: jest.SpyInstance;
  let jpeg: Buffer;
  let stored: any[];
  let prisma: any;
  let svc: TasksService;

  beforeAll(async () => {
    jpeg = await require("sharp")({ create: { width: 3200, height: 2100, channels: 3, background: "#aa5522" } }).jpeg().toBuffer();
  });

  beforeEach(() => {
    KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
    Object.assign(process.env, ENV);
    send = jest.spyOn(S3Client.prototype as any, "send").mockResolvedValue({} as never);

    stored = [];
    const task = { id: 5, staffId: 7, status: "IN_PROGRESS", dueAt: null, confirmedAt: null };
    prisma = {
      task: {
        findUnique: jest.fn(async () => task),
        findUniqueOrThrow: jest.fn(async () => ({
          ...task, title: "t", description: null, priority: "NORMAL", masterComment: null, adminComment: null, doneAt: null,
          createdAt: new Date(), staff: { id: 7, fullName: "М" },
          photos: stored.map((p) => ({ id: p.id, key: p.key, uploadedBy: p.uploadedBy, createdAt: new Date() })),
        })),
      },
      taskPhoto: {
        count: jest.fn(async () => stored.length),
        create: jest.fn(async ({ data }) => { const row = { id: stored.length + 1, ...data }; stored.push(row); return row; }),
        findFirst: jest.fn(async ({ where }) => stored.find((p) => p.id === where.id) ?? null),
        delete: jest.fn(async ({ where }) => { stored = stored.filter((p) => p.id !== where.id); }),
      },
    };
    const audit: any = { log: jest.fn(async () => undefined) };
    const notifications: any = { notify: jest.fn(async () => undefined) };
    svc = new TasksService(prisma, audit, notifications, new ObjectStorageService());
  });

  afterEach(() => {
    send.mockRestore();
    KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  });

  const file = () => ({ buffer: jpeg, originalname: "IMG_0001.jpg" }) as Express.Multer.File;

  it("мастер загружает фото: в S3 уходит WebP в admin/tasks/<id>/<uuid>.webp, а ссылка в ответе ведёт на тот же объект", async () => {
    const result: any = await svc.addPhotoAsMaster(7, "ivan", 5, file(), {} as any);

    // 1. что ушло в Selectel
    expect(send).toHaveBeenCalledTimes(1);
    const put = send.mock.calls[0][0];
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input.Bucket).toBe("site-bucket");
    expect(put.input.Key).toMatch(/^admin\/tasks\/5\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/);
    expect(put.input.ContentType).toBe("image/webp");
    expect(put.input.Body.subarray(0, 4).toString("latin1")).toBe("RIFF"); // это WebP, а не исходный JPEG
    expect(put.input.Body.subarray(8, 12).toString("latin1")).toBe("WEBP");
    expect(put.input.Body.length).toBeLessThan(jpeg.length);

    // 2. что записано в БД: ключ без папки и без домена
    const dbKey: string = prisma.taskPhoto.create.mock.calls[0][0].data.key;
    expect(dbKey).toMatch(/^tasks\/5\/[0-9a-f-]{36}\.webp$/);
    expect(put.input.Key).toBe(`admin/${dbKey}`);
    expect(prisma.taskPhoto.create.mock.calls[0][0].data).toMatchObject({ taskId: 5, uploadedBy: "MASTER" });

    // 3. что видит клиент: прямая ссылка на тот же объект (двойной слэш в S3_PUBLIC_URL схлопывается)
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].url).toBe(`https://abc123.selstorage.ru/${put.input.Key}`);
    expect(result.photos[0].key).toBeUndefined();
  });

  it("админ загружает в ту же папку admin/, с пометкой ADMIN", async () => {
    await svc.addPhotoAsAdmin(5, file(), {} as any);
    expect(send.mock.calls[0][0].input.Key).toMatch(/^admin\/tasks\/5\//);
    expect(prisma.taskPhoto.create.mock.calls[0][0].data.uploadedBy).toBe("ADMIN");
  });

  it("каждое фото получает свой UUID: два одинаковых файла не перезаписывают друг друга", async () => {
    await svc.addPhotoAsMaster(7, "ivan", 5, file(), {} as any);
    await svc.addPhotoAsMaster(7, "ivan", 5, file(), {} as any);
    const keys = send.mock.calls.map((c) => c[0].input.Key);
    expect(new Set(keys).size).toBe(2);
  });

  it("удаление фото: из S3 удаляется объект с тем же ключом из admin/", async () => {
    await svc.addPhotoAsMaster(7, "ivan", 5, file(), {} as any);
    const uploadedKey = send.mock.calls[0][0].input.Key;
    send.mockClear();
    await svc.deletePhotoAsMaster(7, "ivan", 5, 1, {} as any);
    const del = send.mock.calls[0][0];
    expect(del).toBeInstanceOf(DeleteObjectCommand);
    expect(del.input).toEqual({ Bucket: "site-bucket", Key: uploadedKey });
  });

  it("хранилище отвечает ошибкой: пользователю 503, в БД записи нет, ключи и адрес сервера не светятся", async () => {
    send.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.5:443 secret-key=AKIA"));
    const err: any = await svc.addPhotoAsMaster(7, "ivan", 5, file(), {} as any).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify(err.getResponse())).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|AKIA/);
    expect(prisma.taskPhoto.create).not.toHaveBeenCalled();
  });

  it("не настроен S3_PUBLIC_URL: загрузка не начинается вообще (иначе файл лёг бы в бакет, а ссылки были бы битыми)", async () => {
    delete process.env.S3_PUBLIC_URL;
    await expect(svc.addPhotoAsMaster(7, "ivan", 5, file(), {} as any)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.taskPhoto.create).not.toHaveBeenCalled();
  });

  it("свою папку можно задать окружением: файл и ссылка идут туда", async () => {
    process.env.S3_FILES_PREFIX = "uploads/staff";
    const result: any = await svc.addPhotoAsAdmin(5, file(), {} as any);
    const key = send.mock.calls[0][0].input.Key;
    expect(key).toMatch(/^uploads\/staff\/tasks\/5\//);
    expect(result.photos[0].url).toBe(`https://abc123.selstorage.ru/${key}`);
  });
});
