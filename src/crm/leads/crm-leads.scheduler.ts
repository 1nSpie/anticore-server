import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CrmLeadsService } from "../leads/crm-leads.service";

@Injectable()
export class CrmLeadsScheduler {
  private readonly logger = new Logger(CrmLeadsScheduler.name);

  constructor(private readonly leads: CrmLeadsService) {}

  /** Каждый час — повторная связь по заявкам с наступившей датой. */
  @Cron("0 * * * *", { timeZone: "Europe/Moscow" })
  async handleFollowUpLeads() {
    const count = await this.leads.processDueFollowUps();
    if (count > 0) {
      this.logger.log(`Перенесено в «На уточнении»: ${count} заявок`);
    }
  }
}
