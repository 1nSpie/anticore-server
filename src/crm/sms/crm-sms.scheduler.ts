import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CrmSmsService } from "./crm-sms.service";

@Injectable()
export class CrmSmsScheduler {
  private readonly logger = new Logger(CrmSmsScheduler.name);

  constructor(private readonly crmSms: CrmSmsService) {}

  /** Ежедневно в 10:00 по Москве */
  @Cron("0 10 * * *", { timeZone: "Europe/Moscow" })
  async handleBirthdaySms() {
    this.logger.log("Запуск поздравлений с ДР");
    await this.crmSms.sendBirthdayGreetings();
  }
}
