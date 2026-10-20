import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const port = process.env.PORT ?? 4444;
  const isDev = process.env.NODE_ENV
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());

  const origins = [
    "https://xn--80aaag6amsblus.xn--p1ai",
    process.env.FRONTEND_BASE_URL ?? "",
    process.env.SERVER_SELECTEL ?? "",
  ].filter((origin) => origin !== "");

  app.enableCors({
    origin: isDev ? 'http://localhost:3000' :origins,
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    credentials: true,
  });

  // Картинки и видео лежат в Selectel S3 — бэк файлов не отдаёт (см. anticore-client/src/lib/media.ts)
  // Для работы за прокси
  app.set("trust proxy", true);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("AvantKor API")
    .setDescription("Публичный API сайта и внутренняя CRM")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  // LISTEN_HOST=127.0.0.1 — слушать только локально (за nginx); без переменной — на всех интерфейсах, как раньше
  await app.listen(port, process.env.LISTEN_HOST || "0.0.0.0");
}
bootstrap().catch((err) => console.error(err));
