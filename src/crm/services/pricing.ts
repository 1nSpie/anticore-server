import { BadRequestException } from "@nestjs/common";

export type PricingInput = {
  items: { priceRub: number | null }[];
  /** Стоимость, введённая вручную (записи без перечня работ). */
  fallbackPriceRub: number | null;
  discountPercent: number | null;
  discountRub: number | null;
  paidRub: number | null;
};

export type Pricing = {
  /** Предварительная стоимость; null — «не определена» (это не 0 ₽, ТЗ §8.5). */
  preliminary: number | null;
  discountPercent: number | null;
  discountRub: number;
  /** Согласованный итог = предварительная стоимость − скидка. */
  agreedTotal: number | null;
  paidRub: number;
  remaining: number | null;
};

/**
 * Стоимость записи в целых рублях. Предварительная стоимость — сумма позиций перечня работ, если у всех
 * позиций цена указана (0 — «бесплатно», пусто — «не определена»); без перечня — введённая вручную.
 * Скидка задаётся либо процентом (округляется до рубля), либо суммой.
 */
export function computePricing(input: PricingInput): Pricing {
  const { items } = input;
  const preliminary =
    items.length > 0
      ? items.every((i) => i.priceRub != null)
        ? items.reduce((sum, i) => sum + (i.priceRub as number), 0)
        : null
      : input.fallbackPriceRub;

  let discountRub = 0;
  if (preliminary != null) {
    discountRub =
      input.discountPercent != null
        ? Math.round((preliminary * input.discountPercent) / 100)
        : Math.min(input.discountRub ?? 0, preliminary);
  }
  const agreedTotal = preliminary == null ? null : Math.max(0, preliminary - discountRub);
  const paidRub = input.paidRub ?? 0;
  return {
    preliminary,
    discountPercent: input.discountPercent,
    discountRub,
    agreedTotal,
    paidRub,
    remaining: agreedTotal == null ? null : agreedTotal - paidRub,
  };
}

/** Скидку задают процентом или суммой, не обоими сразу; null сбрасывает скидку. */
export function checkDiscount(percent: number | null | undefined, rub: number | null | undefined) {
  if (percent != null && rub != null) {
    throw new BadRequestException("Скидку можно задать либо в процентах, либо в рублях");
  }
  if (percent != null && (percent < 0 || percent > 100)) {
    throw new BadRequestException("Скидка в процентах: от 0 до 100");
  }
  if (rub != null && (!Number.isInteger(rub) || rub < 0)) {
    throw new BadRequestException("Скидка в рублях: целое неотрицательное число");
  }
}

export type ActualItem = {
  kind: "AGREED" | "EXTRA";
  status: string;
  priceRub: number | null;
  approvalStatus: string | null;
};

export type ActualPricing = {
  /** Основные работы без отменённых по согласованию; null — у какой-то позиции цена не определена. */
  main: number | null;
  /** Допработы, согласованные клиентом (несогласованные и отказанные в сумму не входят). */
  extras: number | null;
  gross: number | null;
  discountRub: number;
  /** Итог = основные работы + допработы − скидка (ТЗ §14.4); каждая работа учтена один раз. */
  total: number | null;
  paidRub: number;
  remaining: number | null;
};

/** Согласованные до работ (договор) — отдельно от допработ. */
export const agreedOnly = <T extends { kind: string }>(items: T[]): T[] =>
  items.filter((i) => i.kind === "AGREED");

const sumPrices = (items: { priceRub: number | null }[]): number | null =>
  items.every((i) => i.priceRub != null)
    ? items.reduce((sum, i) => sum + (i.priceRub as number), 0)
    : null;

/** Фактическая стоимость для акта выполненных работ. Скидка в процентах считается от общей суммы работ. */
export function computeActual(input: {
  items: ActualItem[];
  discountPercent: number | null;
  discountRub: number | null;
  paidRub: number | null;
}): ActualPricing {
  const main = sumPrices(input.items.filter((i) => i.kind === "AGREED" && i.status !== "CANCELLED"));
  const extras = sumPrices(
    input.items.filter((i) => i.kind === "EXTRA" && i.approvalStatus === "APPROVED" && i.status !== "CANCELLED"),
  );
  const gross = main != null && extras != null ? main + extras : null;
  let discountRub = 0;
  if (gross != null) {
    discountRub =
      input.discountPercent != null
        ? Math.round((gross * input.discountPercent) / 100)
        : Math.min(input.discountRub ?? 0, gross);
  }
  const total = gross == null ? null : Math.max(0, gross - discountRub);
  const paidRub = input.paidRub ?? 0;
  return { main, extras, gross, discountRub, total, paidRub, remaining: total == null ? null : total - paidRub };
}
