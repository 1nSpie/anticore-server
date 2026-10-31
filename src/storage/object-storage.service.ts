import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Файлы админки и кабинета мастера (фото задач) в **публичном** бакете Selectel — в отдельной папке.
 *
 * Приватности как таковой нет: любой, у кого есть ссылка, откроет файл. Защита — в том, что имя файла
 * это случайный UUID (122 бита), его нельзя ни угадать, ни перебрать, а список файлов бакета наружу не отдаётся.
 * Ссылку знают только те, кому её показал бэкенд (админ и исполнитель задачи).
 * Поэтому: список объектов в бакете должен быть закрыт, а ссылки нельзя светить в публичных местах.
 *
 * Env: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION` — те же, что у `MediaService`;
 * `S3_PUBLIC_URL` — публичный адрес бакета для ссылок; `S3_FILES_PREFIX` — папка (по умолчанию `admin`).
 */
@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);
  private client?: S3Client;

  isConfigured(): boolean {
    return !!(this.bucket() && this.credentials() && this.publicBase());
  }

  /** Положить объект. Ключ — относительный (`tasks/12/uuid.webp`), папка добавляется здесь. */
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.requireConfigured();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: this.fullKey(key),
          Body: body,
          ContentType: contentType,
          // Имя уникально и не переиспользуется, но удалённое фото не должно долго жить в кэшах
          CacheControl: "public, max-age=3600",
        }),
        { abortSignal: AbortSignal.timeout(45_000) },
      );
    } catch (e) {
      this.logger.error(`Не удалось загрузить ${key}: ${(e as Error).message}`);
      throw new ServiceUnavailableException("Не удалось сохранить файл. Попробуйте ещё раз");
    }
  }

  /** Удалить объект. Не бросает: сиротский файл в хранилище лучше, чем сорванная операция пользователя. */
  async remove(key: string): Promise<void> {
    if (!this.isConfigured()) return;
    const { client, bucket } = this.requireConfigured();
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: this.fullKey(key) }), { abortSignal: AbortSignal.timeout(15_000) });
    } catch (e) {
      this.logger.warn(`Не удалось удалить ${key}: ${(e as Error).message}`);
    }
  }

  /** Прямая ссылка на файл; `null`, если хранилище не настроено. */
  publicUrl(key: string): string | null {
    const base = this.publicBase();
    if (!base || !this.isConfigured()) return null;
    return `${base}/${this.fullKey(key)}`;
  }

  private prefix() {
    return (process.env.S3_FILES_PREFIX?.trim() || "admin").replace(/^\/+|\/+$/g, "");
  }

  private fullKey(key: string) {
    // Ключи строит только сервер (tasks/<id>/<uuid>.webp), но на всякий случай не даём выйти из папки
    if (key.includes("..") || key.includes("\\")) throw new Error(`Недопустимый ключ объекта: ${key}`);
    return `${this.prefix()}/${key.replace(/^\/+/, "")}`;
  }

  private bucket() {
    return process.env.S3_BUCKET?.trim() || undefined;
  }

  private publicBase() {
    return process.env.S3_PUBLIC_URL?.trim().replace(/\/+$/, "") || undefined;
  }

  private credentials() {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
    return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
  }

  private requireConfigured(): { client: S3Client; bucket: string } {
    const bucket = this.bucket();
    const credentials = this.credentials();
    if (!bucket || !credentials || !this.publicBase()) {
      throw new ServiceUnavailableException("Хранилище файлов ещё не настроено");
    }
    this.client ??= new S3Client({
      endpoint: process.env.S3_ENDPOINT || "https://s3.ru-3.storage.selcloud.ru",
      region: process.env.S3_REGION || "ru-3",
      forcePathStyle: true,
      credentials,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      maxAttempts: 2,
    });
    return { client: this.client, bucket };
  }
}
