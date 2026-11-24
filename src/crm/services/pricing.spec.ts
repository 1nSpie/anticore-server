import { checkDiscount, computePricing } from './pricing';

const base = { items: [], fallbackPriceRub: null, discountPercent: null, discountRub: null, paidRub: null };

describe('стоимость записи', () => {
  it('предварительная стоимость — сумма позиций', () => {
    const p = computePricing({ ...base, items: [{ priceRub: 30000 }, { priceRub: 15000 }] });
    expect(p).toMatchObject({ preliminary: 45000, discountRub: 0, agreedTotal: 45000, paidRub: 0, remaining: 45000 });
  });

  it('«не определена» (null) и «бесплатно» (0) — разные состояния', () => {
    expect(computePricing({ ...base, items: [{ priceRub: 100 }, { priceRub: null }] }).preliminary).toBeNull();
    const free = computePricing({ ...base, items: [{ priceRub: 0 }] });
    expect(free.preliminary).toBe(0);
    expect(free.agreedTotal).toBe(0);
    const unknown = computePricing({ ...base, items: [{ priceRub: null }] });
    expect(unknown.agreedTotal).toBeNull();
    expect(unknown.remaining).toBeNull();
  });

  it('без перечня работ берётся введённая вручную стоимость', () => {
    expect(computePricing({ ...base, fallbackPriceRub: 12000 }).preliminary).toBe(12000);
    expect(computePricing({ ...base }).preliminary).toBeNull();
  });

  it('скидка в процентах округляется до рубля, итог и остаток считаются от неё', () => {
    const p = computePricing({ ...base, items: [{ priceRub: 33333 }], discountPercent: 10, paidRub: 10000 });
    expect(p.discountRub).toBe(3333);
    expect(p.agreedTotal).toBe(30000);
    expect(p.remaining).toBe(20000);
  });

  it('скидка в рублях не может превысить стоимость', () => {
    const p = computePricing({ ...base, items: [{ priceRub: 1000 }], discountRub: 5000 });
    expect(p.discountRub).toBe(1000);
    expect(p.agreedTotal).toBe(0);
  });

  it('при изменении перечня скидка в процентах пересчитывается', () => {
    const items = [{ priceRub: 10000 }];
    expect(computePricing({ ...base, items, discountPercent: 10 }).discountRub).toBe(1000);
    items.push({ priceRub: 10000 });
    expect(computePricing({ ...base, items, discountPercent: 10 }).discountRub).toBe(2000);
  });

  it('переплата даёт отрицательный остаток', () => {
    expect(computePricing({ ...base, items: [{ priceRub: 1000 }], paidRub: 1500 }).remaining).toBe(-500);
  });

  it('проверка скидки: одно значение, границы', () => {
    expect(() => checkDiscount(10, 500)).toThrow('либо в процентах, либо в рублях');
    expect(() => checkDiscount(101, null)).toThrow('от 0 до 100');
    expect(() => checkDiscount(-1, null)).toThrow();
    expect(() => checkDiscount(null, 1.5)).toThrow('целое');
    expect(() => checkDiscount(null, null)).not.toThrow();
    expect(() => checkDiscount(15.5, undefined)).not.toThrow();
  });
});

import { computeActual } from './pricing';

describe('фактическая стоимость для акта выполненных работ', () => {
  const agreed = (priceRub: number | null, status = 'DONE') => ({ kind: 'AGREED' as const, status, priceRub, approvalStatus: null });
  const extra = (priceRub: number | null, approvalStatus: string, status = 'DONE') => ({ kind: 'EXTRA' as const, status, priceRub, approvalStatus });
  const calc = (items: ReturnType<typeof agreed>[] | any[], discountPercent: number | null = null, discountRub: number | null = null, paidRub: number | null = null) =>
    computeActual({ items, discountPercent, discountRub, paidRub });

  it('итог = основные работы + согласованные допработы − скидка', () => {
    const r = calc([agreed(40000), extra(5000, 'APPROVED')], 10, null, 10000);
    expect(r).toMatchObject({ main: 40000, extras: 5000, gross: 45000, discountRub: 4500, total: 40500, remaining: 30500 });
  });

  it('несогласованные и отказанные допработы в сумму не входят', () => {
    const r = calc([agreed(1000), extra(500, 'PENDING', 'NEEDS_APPROVAL'), extra(700, 'REJECTED', 'CANCELLED')]);
    expect(r.extras).toBe(0);
    expect(r.total).toBe(1000);
  });

  it('работа, отменённая по согласованию, не входит в итог', () => {
    expect(calc([agreed(1000), agreed(2000, 'CANCELLED')]).main).toBe(1000);
    expect(calc([agreed(1000), extra(300, 'APPROVED', 'CANCELLED')]).extras).toBe(0);
  });

  it('у работы без цены итог «не определён», а 0 ₽ — допустим', () => {
    const unknown = calc([agreed(1000), agreed(null)]);
    expect(unknown.main).toBeNull();
    expect(unknown.total).toBeNull();
    expect(unknown.remaining).toBeNull();
    expect(calc([agreed(0)]).total).toBe(0);
    expect(calc([agreed(1000), extra(null, 'APPROVED')]).total).toBeNull();
  });

  it('скидка в рублях ограничена суммой работ', () => {
    expect(calc([agreed(1000)], null, 5000).total).toBe(0);
  });

  it('без допработ итог равен основным работам за вычетом скидки', () => {
    expect(calc([agreed(100000)], 5).total).toBe(95000);
  });
});
