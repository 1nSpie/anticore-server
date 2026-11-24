import { CrmServicesService } from './crm-services.service';

const req = { admin: { id: 'staff:8', login: 'anna' }, headers: {} } as never;

function setup(opts: { signed?: boolean } = {}) {
  const anticor = {
    id: 1, code: 'ANTICOR', name: 'Антикоррозийная обработка', active: true, sortOrder: 1,
    groups: [
      { id: 10, key: 'kind', label: 'Основные виды', multiple: true, allowCustom: false, sortOrder: 1, options: [{ id: 100, name: 'Комплексная обработка', active: true, sortOrder: 1 }, { id: 101, name: 'Базовая обработка', active: true, sortOrder: 2 }] },
      { id: 11, key: 'zones', label: 'Зоны автомобиля', multiple: true, allowCustom: true, sortOrder: 2, options: [{ id: 110, name: 'Днище', active: true, sortOrder: 1 }, { id: 111, name: 'Старая зона', active: false, sortOrder: 2 }] },
    ],
  };
  const laser = { id: 2, code: 'LASER', name: 'Лазерная очистка коррозии', active: true, sortOrder: 2, groups: [{ id: 20, key: 'zones', label: 'Элементы и зоны очистки', multiple: true, allowCustom: true, sortOrder: 1, options: [] }] };
  const categories = [anticor, laser];
  const visit: any = { id: 7, priceRub: 0, serviceType: 'Осмотр', discountPercent: null, discountRub: null, paymentMethod: null, paidRub: null };
  const items: any[] = [];
  let itemId = 0;
  const withCategory = (i: any) => ({ ...i, category: categories.find((c) => c.id === i.categoryId) });
  const prisma: any = {
    serviceCategory: {
      findMany: jest.fn(async () => categories),
      findUnique: jest.fn(async ({ where }: any) => categories.find((c) => c.id === where.id) ?? null),
    },
    serviceOptionGroup: {
      findUnique: jest.fn(async ({ where }: any) => {
        for (const c of categories) { const g = c.groups.find((x) => x.id === where.id); if (g) return g; }
        return null;
      }),
    },
    serviceOption: {
      create: jest.fn(async ({ data }: any) => ({ id: 999, active: true, ...data })),
      update: jest.fn(async ({ where, data }: any) => {
        for (const c of categories) for (const g of c.groups) { const o = g.options.find((x) => x.id === where.id); if (o) return Object.assign(o, data); }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        for (const c of categories) for (const g of c.groups) { const o = g.options.find((x) => x.id === where.id); if (o) return o; }
        return null;
      }),
    },
    visitHistory: {
      findUnique: jest.fn(async () => ({ ...visit, workItems: items.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(withCategory) })),
      update: jest.fn(async ({ data }: any) => Object.assign(visit, data)),
    },
    visitWorkItem: {
      findFirst: jest.fn(async () => items.length ? { sortOrder: Math.max(...items.map((i) => i.sortOrder)) } : null),
      create: jest.fn(async ({ data }: any) => { const i = { id: ++itemId, kind: 'AGREED', ...data }; items.push(i); return i; }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(items.find((i) => i.id === where.id), data)),
      delete: jest.fn(async ({ where }: any) => { items.splice(items.findIndex((i) => i.id === where.id), 1); }),
    },
    documentVersion: { findFirst: jest.fn(async () => (opts.signed ? { id: 1 } : null)) },
  };
  const audit: any = { log: jest.fn(async () => undefined) };
  return { svc: new CrmServicesService(prisma, audit), prisma, audit, visit, items };
}

describe('CrmServicesService: перечень работ', () => {
  it('добавление позиции: цена и название услуги записи считаются из перечня', async () => {
    const { svc, visit } = setup();
    await svc.addWork(7, { categoryId: 1, selections: { kind: ['Комплексная обработка'], zones: ['Днище'] }, priceRub: 30000 }, req);
    const r = await svc.addWork(7, { categoryId: 2, selections: { zones: ['Пороги'] }, priceRub: 15000, comment: 'Только левый' }, req);
    expect(visit.priceRub).toBe(45000);
    expect(visit.serviceType).toBe('Антикоррозийная обработка; Лазерная очистка коррозии');
    expect(r.items.map((i) => i.title)).toEqual([
      'Антикоррозийная обработка: Комплексная обработка; зоны: Днище',
      'Лазерная очистка коррозии: зоны: Пороги',
    ]);
    expect(r.pricing.preliminary).toBe(45000);
  });

  it('позиция без цены делает стоимость «не определена» и не затирает прежнюю цену записи', async () => {
    const { svc, visit } = setup();
    visit.priceRub = 777;
    const r = await svc.addWork(7, { categoryId: 1, selections: { kind: ['Базовая обработка'] } }, req);
    expect(r.pricing.preliminary).toBeNull();
    expect(visit.priceRub).toBe(777);
    const zero = await svc.updateWork(7, r.items[0].id, { priceRub: 0 }, req);
    expect(zero.pricing.preliminary).toBe(0);
    expect(visit.priceRub).toBe(0);
  });

  it('пустая позиция отклоняется, достаточно параметра или комментария', async () => {
    const { svc } = setup();
    await expect(svc.addWork(7, { categoryId: 1, selections: {} }, req)).rejects.toThrow('хотя бы один параметр');
    await expect(svc.addWork(7, { categoryId: 1, selections: {}, comment: 'Осмотр по месту' }, req)).resolves.toBeDefined();
  });

  it('значение вне справочника и неизвестная категория отклоняются', async () => {
    const { svc } = setup();
    await expect(svc.addWork(7, { categoryId: 1, selections: { kind: ['Экспресс'] } }, req)).rejects.toThrow('нет в справочнике');
    await expect(svc.addWork(7, { categoryId: 99, selections: { kind: ['x'] } }, req)).rejects.toThrow('Категория услуг не найдена');
  });

  it('удаление позиции пересчитывает цену; последняя позиция оставляет прежнюю цену', async () => {
    const { svc, visit } = setup();
    await svc.addWork(7, { categoryId: 1, selections: { kind: ['Базовая обработка'] }, priceRub: 100 }, req);
    const r = await svc.addWork(7, { categoryId: 2, selections: { zones: ['Днище'] }, priceRub: 50 }, req);
    expect(visit.priceRub).toBe(150);
    const after = await svc.deleteWork(7, r.items[1].id, undefined, req);
    expect(after.pricing.preliminary).toBe(100);
    expect(visit.priceRub).toBe(100);
  });

  it('после подписания договора менять перечень можно только с указанием, как согласовано', async () => {
    const { svc, prisma, audit } = setup({ signed: true });
    await expect(svc.addWork(7, { categoryId: 1, selections: { kind: ['Базовая обработка'] }, priceRub: 1 }, req)).rejects.toThrow('Договор подписан');
    expect(prisma.visitWorkItem.create).not.toHaveBeenCalled();
    await svc.addWork(7, { categoryId: 1, selections: { kind: ['Базовая обработка'] }, priceRub: 1, reason: 'Согласовал по телефону, Иванов, 22.11' }, req);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'WORK_ITEM_CHANGED', actor: 'anna',
      meta: expect.objectContaining({ change: 'added', reason: 'Согласовал по телефону, Иванов, 22.11' }),
    }));
  });

  it('изменение пишется в журнал со старым и новым значением', async () => {
    const { svc, audit } = setup();
    const r = await svc.addWork(7, { categoryId: 1, selections: { kind: ['Базовая обработка'] }, priceRub: 100 }, req);
    await svc.updateWork(7, r.items[0].id, { priceRub: 250 }, req);
    const meta = audit.log.mock.calls.at(-1)[0].meta;
    expect(meta.change).toBe('changed');
    expect(meta.before.priceRub).toBe(100);
    expect(meta.after.priceRub).toBe(250);
  });

  it('несуществующая позиция — 404', async () => {
    const { svc } = setup();
    await expect(svc.updateWork(7, 5, { priceRub: 1 }, req)).rejects.toThrow('Позиция не найдена');
    await expect(svc.deleteWork(7, 5, undefined, req)).rejects.toThrow('Позиция не найдена');
  });
});

describe('CrmServicesService: стоимость и справочник', () => {
  it('скидка в процентах: итог и остаток считаются, способ оплаты и оплата сохраняются', async () => {
    const { svc } = setup();
    await svc.addWork(7, { categoryId: 1, selections: { kind: ['Базовая обработка'] }, priceRub: 40000 }, req);
    const r = await svc.updatePricing(7, { discountPercent: 10, paymentMethod: 'CARD_SBP', paidRub: 10000 }, req);
    expect(r.pricing).toMatchObject({ preliminary: 40000, discountRub: 4000, agreedTotal: 36000, paidRub: 10000, remaining: 26000 });
    expect(r.paymentMethod).toBe('CARD_SBP');
  });

  it('скидка либо в процентах, либо в рублях; null сбрасывает', async () => {
    const { svc } = setup();
    await svc.addWork(7, { categoryId: 1, selections: { kind: ['Базовая обработка'] }, priceRub: 1000 }, req);
    await expect(svc.updatePricing(7, { discountPercent: 10, discountRub: 100 }, req)).rejects.toThrow('либо в процентах');
    await svc.updatePricing(7, { discountRub: 300 }, req);
    const reset = await svc.updatePricing(7, { discountPercent: null, discountRub: null }, req);
    expect(reset.pricing.discountRub).toBe(0);
  });

  it('скидку после подписания договора меняют только с причиной, оплату — свободно', async () => {
    const { svc } = setup({ signed: true });
    await expect(svc.updatePricing(7, { discountPercent: 5 }, req)).rejects.toThrow('Договор подписан');
    await expect(svc.updatePricing(7, { paidRub: 500 }, req)).resolves.toBeDefined();
    await expect(svc.updatePricing(7, { discountPercent: 5, reason: 'Скидка постоянному клиенту' }, req)).resolves.toBeDefined();
  });

  it('справочник: новый вариант добавляется, дубль — нет, отключённый включается обратно', async () => {
    const { svc, prisma } = setup();
    const added = await svc.addOption(10, '  Экспресс-обработка ', req);
    expect(prisma.serviceOption.create).toHaveBeenCalledWith({ data: { groupId: 10, name: 'Экспресс-обработка', sortOrder: 3 } });
    expect(added.name).toBe('Экспресс-обработка');
    await expect(svc.addOption(10, 'базовая обработка', req)).rejects.toThrow('уже есть');
    const back = await svc.addOption(11, 'старая зона', req);
    expect(back.active).toBe(true);
    await expect(svc.addOption(10, '   ', req)).rejects.toThrow('Введите название');
    await expect(svc.addOption(55, 'x', req)).rejects.toThrow('Группа не найдена');
  });

  it('вариант можно переименовать и отключить; изменение попадает в журнал', async () => {
    const { svc, audit } = setup();
    const r = await svc.updateOption(101, { active: false }, req);
    expect(r.active).toBe(false);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SERVICE_OPTION_CHANGED' }));
    await expect(svc.updateOption(5000, { active: false }, req)).rejects.toThrow('не найден');
    await expect(svc.updateOption(100, { name: ' ' }, req)).rejects.toThrow('Введите название');
  });

  it('каталог отдаёт только включённые значения, а с all=1 — все', async () => {
    const { svc } = setup();
    const active = await svc.catalog();
    expect(active[0].groups[1].options.map((o) => o.name)).toEqual(['Днище']);
    const all = await svc.catalog(true);
    expect(all[0].groups[1].options.map((o) => o.name)).toEqual(['Днище', 'Старая зона']);
  });
});
