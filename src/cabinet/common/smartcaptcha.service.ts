import { BadRequestException, Injectable, Logger } from "@nestjs/common";

type SmartCaptchaValidateResponse = {
  status: "ok" | "failed";
  message?: string;
};

/**
 * Yandex SmartCaptcha.
 * @see https://yandex.cloud/ru/docs/smartcaptcha/
 */
@Injectable()
export class SmartCaptchaService {
  private readonly logger = new Logger(SmartCaptchaService.name);

  async verifyOrThrow(token: string | undefined, remoteIp?: string) {
    const secret = process.env.SMARTCAPTCHA_SERVER_KEY?.trim();
    if (!secret) {
      this.logger.error(
        "SMARTCAPTCHA_SERVER_KEY не задан — регистрация заблокирована",
      );
      throw new BadRequestException(
        "Капча временно недоступна. Попробуйте позже или обратитесь в поддержку.",
      );
    }

    const trimmed = token?.trim();
    if (!trimmed) {
      throw new BadRequestException("Пройдите проверку «Я не робот»");
    }

    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("token", trimmed);
    if (remoteIp) {
      body.set("ip", remoteIp);
    }

    let data: SmartCaptchaValidateResponse;
    try {
      const res = await fetch(
        "https://smartcaptcha.cloud.yandex.ru/validate",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        },
      );
      data = (await res.json()) as SmartCaptchaValidateResponse;
    } catch (e) {
      this.logger.warn(`SmartCaptcha validate failed: ${String(e)}`);
      throw new BadRequestException(
        "Не удалось проверить капчу. Попробуйте ещё раз.",
      );
    }

    if (data.status !== "ok") {
      this.logger.debug(`SmartCaptcha rejected: ${data.message ?? "failed"}`);
      throw new BadRequestException(
        "Проверка капчи не пройдена. Обновите виджет и попробуйте снова.",
      );
    }
  }
}
