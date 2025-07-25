import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";

async function bootstrap() {
  const port = process.env.PORT ?? 4444;
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: [
      process.env.FRONTEND_BASE_URL ?? "",
      process.env.SERVER_SELECTEL ?? "",
    ],
    credentials: true,
  });

  app.enableCors({
    origin: "https://xn--80aaag6amsblus.xn--p1ai",
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  });

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, "..", "public"), {
    prefix: "/static/",
  });
  // Для работы за прокси
  app.set("trust proxy", true);

  await app.listen(port);
}
bootstrap().catch((err) => console.error(err));
