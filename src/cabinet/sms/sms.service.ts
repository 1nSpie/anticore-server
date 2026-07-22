import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { isPublicClientIp } from "../common/client-ip.util";

type SmsRuSmsRow = {
  status?: string;
  status_code?: number | string;
  status_text?: string;
};

type SmsRuSendResponse = {
  status?: string;
  status_code?: number | string;
  status_text?: string;
  sms?: Record<string, SmsRuSmsRow>;
};

function isOkCode(code: unknown): boolean {
  return code === 100 || code === "100";
}

/**
 * Отправка SMS через SMS.ru (https://sms.ru).
 * Если SMS_RU_API_ID не задан — код пишется в лог (удобно для локальной разработки).
 *
 * Рекомендация SMS.ru: передавать IP пользователя в `&ip=` для защиты от подозрительного трафика.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiId = process.env.SMS_RU_API_ID?.trim() ?? "";

  async sendCode(
    phone: string,
    message: string,
    opts?: { clientIp?: string },
  ): Promise<void> {
    const to = phone.startsWith("+") ? phone.slice(1) : phone;

    if (!this.apiId) {
      this.logger.warn(
        `[SMS отключён] На ${to}: ${message} (задайте SMS_RU_API_ID в .env)`,
      );
      return;
    }

    const url = "https://sms.ru/sms/send";
    const params: Record<string, string | number> = {
      api_id: this.apiId,
      to,
      msg: message,
      json: 1,
    };
    const ip = opts?.clientIp?.trim();
    if (ip && isPublicClientIp(ip)) {
      params.ip = ip;
    } else if (ip) {
      this.logger.debug(
        `SMS.ru: параметр ip не передан (${ip} — локальный/приватный адрес)`,
      );
    } else {
      this.logger.debug(
        "SMS.ru: параметр ip не передан (IP клиента неизвестен)",
      );
    }

    let data: SmsRuSendResponse;
    try {
      const res = await axios.get<SmsRuSendResponse>(url, {
        params,
        timeout: 15000,
        validateStatus: () => true,
      });
      data = res.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Сеть";
      this.logger.error(`SMS.ru запрос: ${msg}`);
      throw new BadGatewayException(
        "Не удалось связаться с SMS-провайдером. Попробуйте позже.",
      );
    }

    if (typeof data === "string" || !data || typeof data !== "object") {
      this.logger.error("SMS.ru: не JSON", String(data).slice(0, 200));
      throw new BadGatewayException("Некорректный ответ SMS-провайдера");
    }

    if (data.status !== "OK" || !isOkCode(data.status_code)) {
      this.logger.error("SMS.ru (запрос):", JSON.stringify(data));
      throw new BadGatewayException(
        data.status_text ||
          `SMS.ru: ошибка запроса (код ${String(data.status_code)})`,
      );
    }

    const sms = data.sms;
    if (!sms || typeof sms !== "object") {
      this.logger.error("SMS.ru: нет блока sms:", JSON.stringify(data));
      throw new BadGatewayException("Некорректный ответ SMS-провайдера");
    }

    let row = sms[to];
    if (!row) {
      const keys = Object.keys(sms);
      if (keys.length === 1) {
        row = sms[keys[0]!];
      }
    }
    if (!row) {
      this.logger.error(
        `SMS.ru: нет статуса по номеру ${to}:`,
        JSON.stringify(data),
      );
      throw new BadGatewayException(
        "Не удалось отправить SMS на указанный номер",
      );
    }

    if (row.status !== "OK" || !isOkCode(row.status_code)) {
      this.logger.error(
        "SMS.ru (номер):",
        JSON.stringify({ to, row, balance: (data as { balance?: unknown }).balance }),
      );
      throw new BadGatewayException(
        row.status_text ||
          `Не удалось доставить SMS (код ${String(row.status_code)})`,
      );
    }

    this.logger.log(
      `SMS.ru: сообщение принято к отправке, номер ${to}` +
        (params.ip ? `, ip=${params.ip}` : ""),
    );
  }
}
