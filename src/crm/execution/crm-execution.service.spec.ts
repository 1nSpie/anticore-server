import { CrmExecutionService } from './crm-execution.service';

const req = { admin: { id: 'staff:8', login: 'anna' }, headers: {} } as never;

function setup(opts: { assignees?: { id: number; fullName: string }[]; signed?: boolean; photoCount?: number } = {}) {
  const assignees = opts.assignees ?? [{ id: 3, fullName: 'Мастер Иван' }];
  const category = { id: 1, name: 'Антикоррозийная обработка', active: true, groups: [{ id: 10, key: 'kind', label: 'Основные виды', multiple: true, allowCustom: false, sortOrder: 1, options: [{ id: 100, name: 'Базовая обработка', active: true, sortOrder: 1 }] }] };
  const items: any[] = [];
  let itemId = 0;
  const visit: any = { id: 7, discountPercent: null, discountRub: null, paidRub: null, handover: null, inspection: { mileageKm: 100000, fuelPercent: 50 } };
  const staff = [{ id: 3, fullName: 'Мастер Иван' }, { id: 4, fullName: 'Мастер Пётр' }];
  const mkItem = (over: any) => {
    const it = {
      id: ++itemId, visitId: 7, categoryId: 1, kind: 'AGREED', status: 'WAITING', selections: { kind: ['Базовая обработка'] }, comment: null, priceRub: 1000, sortOrder: itemId,
      masterId: null, startedAt: null, finishedAt: null, actualVolume: null, workNote: null, defectPlace: null, termChangeNote: null,
      approvalStatus: null, approvedAt: null, approvedBy: null, approvalChannel: null, approvalNote: null, ...over,
    };
    items.push(it);
    return it;
  };
  const photos: any[] = [];
  const view = (it: any) => ({
    ...it, category: { ...category, groups: category.groups.map(({ key, sortOrder }) => ({ key, sortOrder })) },
    master: it.masterId ? staff.find((s) => s.id === it.masterId) ?? null : null,
    photos: photos.filter((p) => p.workItemId === it.id),
  });
  const prisma: any = {
    visitHistory: { findUnique: jest.fn(async () => ({ ...visit, workItems: items.map(view), assignees: assignees.map((a) => ({ staff: a })) })) },
    staff: {
      findMany: jest.fn(async () => staff),
      findUnique: jest.fn(async ({ where }: any) => (staff.some((s) => s.id === where.id) ? { id: where.id } : null)),
    },
    serviceCategory: { findUnique: jest.fn(async ({ where }: any) => (where.id === 1 ? category : null)) },
    visitWorkItem: {
      update: jest.fn(async ({ where, data }: any) => Object.assign(items.find((i) => i.id === where.id), data)),
      create: jest.fn(async ({ data }: any) => mkItem(data)),
      delete: jest.fn(async ({ where }: any) => { items.splice(items.findIndex((i) => i.id === where.id), 1); }),
    },
    visitPhoto: {
      count: jest.fn(async () => opts.photoCount ?? photos.length),
      create: jest.fn(async ({ data }: any) => { photos.push({ id: photos.length + 1, ...data }); }),
      findFirst: jest.fn(async ({ where }: any) => photos.find((p) => p.id === where.id && p.workItemId === where.workItemId) ?? null),
      delete: jest.fn(async ({ where }: any) => { photos.splice(photos.findIndex((p) => p.id === where.id), 1); }),
    },
    visitHandover: { upsert: jest.fn(async ({ create, update }: any) => { visit.handover = { ...(visit.handover ?? {}), ...(visit.handover ? update : create), issuedBy: null }; return visit.handover; }) },
    documentVersion: { findFirst: jest.fn(async () => (opts.signed ? { id: 1 } : null)) },
  };
  const storage: any = { publicUrl: (k: string) => `https://cdn/${k}`, put: jest.fn(), remove: jest.fn() };
  const audit: any = { log: jest.fn(async () => undefined) };
  return { svc: new CrmExecutionService(prisma, storage, audit), prisma, storage, audit, items, mkItem, visit, photos };
}

describe('выполнение работ', () => {
  it('взять в работу: фиксируется начало, единственный назначенный мастер подставляется сам', async () => {
    const { svc, mkItem } = setup();
    const it = mkItem({});
    const r = await svc.updateItem(7, it.id, { status: 'IN_PROGRESS' }, req);
    expect(r.items[0]).toMatchObject({ status: 'IN_PROGRESS', master: { id: 3 } });
    expect(it.startedAt).toBeInstanceOf(Date);
  });

  it('выполнено: время завершения, объём и комментарий; возврат в работу сбрасывает завершение', async () => {
    const { svc, mkItem } = setup();
    const it = mkItem({});
    await svc.updateItem(7, it.id, { status: 'IN_PROGRESS' }, req);
    await svc.updateItem(7, it.id, { status: 'DONE', actualVolume: 'Днище и арки', workNote: 'Без замечаний' }, req);
    expect(it).toMatchObject({ status: 'DONE', actualVolume: 'Днище и арки', workNote: 'Без замечаний' });
    expect(it.finishedAt).toBeInstanceOf(Date);
    await svc.updateItem(7, it.id, { status: 'IN_PROGRESS' }, req);
    expect(it.finishedAt).toBeNull();
  });

  it('нельзя «перепрыгнуть» статус: из ожидания сразу в «выполнено»', async () => {
    const { svc, mkItem } = setup();
    const it = mkItem({});
    await expect(svc.updateItem(7, it.id, { status: 'DONE' }, req)).rejects.toThrow('Нельзя перевести работу');
  });

  it('при нескольких назначенных мастер должен быть выбран явно', async () => {
    const { svc, mkItem } = setup({ assignees: [{ id: 3, fullName: 'Иван' }, { id: 4, fullName: 'Пётр' }] });
    const it = mkItem({ status: 'IN_PROGRESS', startedAt: new Date() });
    await expect(svc.updateItem(7, it.id, { status: 'DONE' }, req)).rejects.toThrow('ответственного мастера');
    await svc.updateItem(7, it.id, { status: 'DONE', masterId: 4 }, req);
    expect(it.masterId).toBe(4);
    await expect(svc.updateItem(7, it.id, { masterId: 99 }, req)).rejects.toThrow('Мастер не найден');
  });

  it('отмена возможна только с причиной (по согласованию с клиентом)', async () => {
    const { svc, mkItem } = setup();
    const it = mkItem({});
    await expect(svc.updateItem(7, it.id, { status: 'CANCELLED' }, req)).rejects.toThrow('Укажите причину');
    await svc.updateItem(7, it.id, { status: 'CANCELLED', workNote: 'Клиент отказался от арок' }, req);
    expect(it.status).toBe('CANCELLED');
  });

  it('статусы изменений пишутся в журнал', async () => {
    const { svc, mkItem, audit } = setup();
    const it = mkItem({});
    await svc.updateItem(7, it.id, { status: 'IN_PROGRESS' }, req);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'WORK_STATUS_CHANGED', actor: 'anna', meta: expect.objectContaining({ from: 'WAITING', to: 'IN_PROGRESS' }),
    }));
  });

  it('сводка: незавершённые и несогласованные допработы считаются отдельно, фактическое начало — самое раннее', async () => {
    const { svc, mkItem } = setup();
    mkItem({ status: 'DONE', startedAt: new Date('2026-11-22T10:00:00Z'), finishedAt: new Date('2026-11-22T12:00:00Z') });
    mkItem({ status: 'IN_PROGRESS', startedAt: new Date('2026-11-22T09:00:00Z') });
    mkItem({ kind: 'EXTRA', status: 'NEEDS_APPROVAL', approvalStatus: 'PENDING' });
    const r = await svc.get(7);
    expect(r.summary).toEqual({ unfinished: 1, pendingExtras: 1 });
    expect(r.workStartedAt).toEqual(new Date('2026-11-22T09:00:00Z'));
    expect(r.workFinishedAt).toBeNull();
  });
});

describe('допработы и согласование с клиентом', () => {
  const extra = { categoryId: 1, selections: { kind: ['Базовая обработка'] }, comment: 'Сквозная коррозия порога', defectPlace: 'Порог правый', priceRub: 5000, termChangeNote: '+1 день' };

  it('новая допработа ждёт решения клиента и не входит в сумму', async () => {
    const { svc, mkItem } = setup();
    mkItem({ priceRub: 40000, status: 'DONE', startedAt: new Date(), finishedAt: new Date(), masterId: 3 });
    const r = await svc.addExtra(7, extra, req);
    const e = r.items.find((i) => i.kind === 'EXTRA')!;
    expect(e).toMatchObject({ status: 'NEEDS_APPROVAL', defectPlace: 'Порог правый', termChangeNote: '+1 день', approval: { status: 'PENDING' } });
    expect(r.pricing.actual.extras).toBe(0);
    expect(r.pricing.actual.total).toBe(40000);
  });

  it('допработа проверяется по справочнику', async () => {
    const { svc } = setup();
    await expect(svc.addExtra(7, { ...extra, selections: { kind: ['Неизвестная'] } }, req)).rejects.toThrow('нет в справочнике');
    await expect(svc.addExtra(7, { ...extra, categoryId: 9 }, req)).rejects.toThrow('Категория услуг не найдена');
  });

  it('до решения клиента статус допработы менять нельзя', async () => {
    const { svc } = setup();
    const r = await svc.addExtra(7, extra, req);
    await expect(svc.updateItem(7, r.items[0].id, { status: 'IN_PROGRESS' }, req)).rejects.toThrow('ещё не согласована');
  });

  it('согласие фиксирует дату, сотрудника, способ и подтверждение; допработа попадает в сумму и становится выполнимой', async () => {
    const { svc, mkItem } = setup();
    mkItem({ priceRub: 40000, status: 'DONE', startedAt: new Date(), finishedAt: new Date(), masterId: 3 });
    const added = await svc.addExtra(7, extra, req);
    const id = added.items.find((i) => i.kind === 'EXTRA')!.id;
    const r = await svc.decideExtra(7, id, { decision: 'APPROVED', channel: 'MESSENGER', note: 'WhatsApp 22.11 14:05', approvedAt: '2026-11-22T14:05:00.000Z' }, req);
    const e = r.items.find((i) => i.id === id)!;
    expect(e).toMatchObject({ status: 'WAITING', approval: { status: 'APPROVED', channel: 'MESSENGER', approvedBy: 'anna', note: 'WhatsApp 22.11 14:05' } });
    expect(e.approval!.approvedAt).toEqual(new Date('2026-11-22T14:05:00.000Z'));
    expect(r.pricing.actual).toMatchObject({ extras: 5000, total: 45000 });
    await svc.updateItem(7, id, { status: 'IN_PROGRESS' }, req); // теперь работать можно
  });

  it('согласие без цены невозможно: клиент соглашается на конкретную сумму', async () => {
    const { svc } = setup();
    const added = await svc.addExtra(7, { ...extra, priceRub: null }, req);
    await expect(svc.decideExtra(7, added.items[0].id, { decision: 'APPROVED', channel: 'PHONE' }, req)).rejects.toThrow('Укажите стоимость допработы');
  });

  it('отказ клиента отменяет допработу, в сумму она не входит', async () => {
    const { svc, mkItem } = setup();
    mkItem({ priceRub: 1000, status: 'DONE', startedAt: new Date(), finishedAt: new Date(), masterId: 3 });
    const added = await svc.addExtra(7, extra, req);
    const id = added.items.find((i) => i.kind === 'EXTRA')!.id;
    const r = await svc.decideExtra(7, id, { decision: 'REJECTED', channel: 'PHONE' }, req);
    expect(r.items.find((i) => i.id === id)).toMatchObject({ status: 'CANCELLED', approval: { status: 'REJECTED' }, workNote: 'Клиент отказался от допработы' });
    expect(r.pricing.actual.total).toBe(1000);
  });

  it('решение принимается один раз, после него допработу нельзя править; согласованную удалить нельзя', async () => {
    const { svc } = setup();
    const added = await svc.addExtra(7, extra, req);
    const id = added.items[0].id;
    await svc.decideExtra(7, id, { decision: 'APPROVED', channel: 'EMAIL' }, req);
    await expect(svc.decideExtra(7, id, { decision: 'REJECTED', channel: 'EMAIL' }, req)).rejects.toThrow('уже зафиксировано');
    await expect(svc.updateExtra(7, id, { priceRub: 1 }, req)).rejects.toThrow('уже согласована');
    await expect(svc.deleteExtra(7, id, req)).rejects.toThrow('удалить нельзя');
  });

  it('несогласованную допработу можно править и удалить вместе с фото', async () => {
    const { svc, storage } = setup();
    const added = await svc.addExtra(7, extra, req);
    const id = added.items[0].id;
    const upd = await svc.updateExtra(7, id, { priceRub: 7000, comment: 'Уточнили объём' }, req);
    expect(upd.items[0]).toMatchObject({ priceRub: 7000, comment: 'Уточнили объём' });
    await svc.addPhoto(7, id, 'WORK_BEFORE', { buffer: await tinyJpeg() } as never, req);
    const del = await svc.deleteExtra(7, id, req);
    expect(del.items).toHaveLength(0);
    expect(storage.remove).toHaveBeenCalled();
  });

  it('ни агрегатная работа не считается допработой, ни наоборот: чужой id — 404', async () => {
    const { svc, mkItem } = setup();
    const agreed = mkItem({});
    await expect(svc.decideExtra(7, agreed.id, { decision: 'APPROVED', channel: 'PHONE' }, req)).rejects.toThrow('Допработа не найдена');
    await expect(svc.updateItem(7, 999, { status: 'IN_PROGRESS' }, req)).rejects.toThrow('Позиция не найдена');
  });
});

describe('фото до и после', () => {
  it('фото привязывается к работе и этапу; лимит и чужое фото', async () => {
    const { svc, mkItem, prisma, storage } = setup();
    const it = mkItem({});
    const r = await svc.addPhoto(7, it.id, 'WORK_AFTER', { buffer: await tinyJpeg() } as never, req);
    expect(r.items[0].photosAfter).toHaveLength(1);
    expect(r.items[0].photosBefore).toHaveLength(0);
    expect(prisma.visitPhoto.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workItemId: it.id, stage: 'WORK_AFTER', uploadedBy: 'anna' }) });
    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^visits\/7\/.+\.webp$/), expect.anything(), 'image/webp');
    const del = await svc.deletePhoto(7, it.id, r.items[0].photosAfter[0].id, req);
    expect(del.items[0].photosAfter).toHaveLength(0);
    await expect(svc.deletePhoto(7, it.id, 555, req)).rejects.toThrow('Фото не найдено');
  });

  it('лимит фото на запись', async () => {
    const { svc, mkItem } = setup({ photoCount: 60 });
    const it = mkItem({});
    await expect(svc.addPhoto(7, it.id, 'WORK_BEFORE', { buffer: await tinyJpeg() } as never, req)).rejects.toThrow('не больше');
  });
});

describe('после подписания акта выполненных работ факт не меняется', () => {
  it('выполнение, допработы, фото и выдача блокируются', async () => {
    const { svc, mkItem } = setup({ signed: true });
    const it = mkItem({});
    await expect(svc.updateItem(7, it.id, { status: 'IN_PROGRESS' }, req)).rejects.toThrow('подписан');
    await expect(svc.addExtra(7, { categoryId: 1, selections: {}, comment: 'Новый дефект' }, req)).rejects.toThrow('подписан');
    await expect(svc.addPhoto(7, it.id, 'WORK_AFTER', { buffer: Buffer.from('x') } as never, req)).rejects.toThrow('подписан');
    await expect(svc.updateHandover(7, { warrantyBookIssued: true }, req)).rejects.toThrow('подписан');
    await expect(svc.get(7)).resolves.toMatchObject({ signed: true });
  });
});

describe('выдача автомобиля и гарантия', () => {
  it('до заполнения перечисляется, что нужно внести; показатели приёмки подсказаны', async () => {
    const { svc } = setup();
    const r = await svc.getHandover(7);
    expect(r.handover).toBeNull();
    expect(r.reception).toEqual({ mileageKm: 100000, fuelPercent: 50 });
    expect(r.missing.map((m) => m.label)).toEqual([
      'Фактические дата и время выдачи автомобиля',
      'Гарантийная книжка: выдана или нет',
      'Гарантийные условия: разъяснены или нет',
    ]);
  });

  it('гарантия не назначается автоматически: срок и начало нужны, только если книжка выдана', async () => {
    const { svc } = setup();
    let r = await svc.updateHandover(7, { issuedAt: '2026-11-23T17:00:00.000Z', warrantyBookIssued: true, warrantyTermsExplained: true }, req);
    expect(r.missing.map((m) => m.label)).toEqual(['Срок гарантии', 'Начало срока гарантии']);
    r = await svc.updateHandover(7, { warrantyMonths: 24, warrantyStartsAt: '2026-11-23' }, req);
    expect(r.missing).toEqual([]);
    r = await svc.updateHandover(7, { warrantyBookIssued: false, warrantyMonths: null, warrantyStartsAt: null }, req);
    expect(r.missing).toEqual([]);
  });

  it('проверяет значения и сотрудника', async () => {
    const { svc } = setup();
    await expect(svc.updateHandover(7, { fuelPercent: 150 }, req)).rejects.toThrow('Уровень топлива');
    await expect(svc.updateHandover(7, { mileageKm: -1 }, req)).rejects.toThrow('Пробег');
    await expect(svc.updateHandover(7, { warrantyMonths: 0 }, req)).rejects.toThrow('Срок гарантии');
    await expect(svc.updateHandover(7, { issuedById: 999 }, req)).rejects.toThrow('Сотрудник не найден');
    await expect(svc.updateHandover(7, { issuedAt: 'не дата' }, req)).rejects.toThrow('дата');
  });

  it('изменения выдачи попадают в журнал', async () => {
    const { svc, audit } = setup();
    await svc.updateHandover(7, { warrantyBookIssued: true }, req);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'HANDOVER_CHANGED', actor: 'anna' }));
  });
});

/** Крошечный настоящий JPEG, чтобы пройти sharp в normalizePhoto. */
async function tinyJpeg(): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharp = require('sharp');
  return sharp({ create: { width: 4, height: 4, channels: 3, background: '#808080' } }).jpeg().toBuffer();
}
