import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { CrmSmsService } from "../src/crm/sms/crm-sms.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });
  try {
    const sms = app.get(CrmSmsService);
    await sms.sendBirthdayGreetings();
    console.log("Задача поздравлений с ДР выполнена");
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
