import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CrmLeadsService } from "../leads/crm-leads.service";

@Injectable()
export class CrmLeadsScheduler {
  private readonly logger = new Logger(CrmLeadsScheduler.name);

  constructor(private readonly leads: CrmLeadsService) {}

  /**
   * Каждые 5 минут:
   * — «На уточнении» с наступившей датой → снова «Новая» (с 07:30 МСК указанного дня);
   * — заявки с записью на сегодня → «На подъёмнике», перенесённые на будущее → «В календаре».
   */
  @Cron("*/5 * * * *", { timeZone: "Europe/Moscow" })
  async handleLeadStatuses() {
    const resurfaced = await this.leads.processDueFollowUps();
    if (resurfaced > 0) {
      this.logger.log(`Вернулись в «Новые» после уточнения: ${resurfaced}`);
    }
    const { toInProgress, toScheduled } = await this.leads.syncVisitStatuses();
    if (toInProgress > 0 || toScheduled > 0) {
      this.logger.log(
        `Статусы по записям: «На подъёмнике» +${toInProgress}, «В календаре» +${toScheduled}`,
      );
    }
  }
}
