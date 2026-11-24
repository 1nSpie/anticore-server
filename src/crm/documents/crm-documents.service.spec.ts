import { CrmDocumentsService } from './crm-documents.service';
import { INTERIOR_KEYS, SYSTEM_KEYS } from '../inspection/inspection.rules';

const req = { admin: { id: 'staff:8', login: 'anna' }, headers: {} } as never;

/** Минимальная БД в памяти: запись, документы, версии, счётчик номеров. */
function setup(opts: { complete?: boolean; location?: string } = {}) {
  const complete = opts.complete ?? true;
  const visit: any = {
    id: 7, userId: 1, vehicleId: 4, location: opts.location ?? 'RAMENSKOYE', docNumber: null, docDate: null,
    startsAt: new Date('2026-11-22T10:00:00Z'), endsAt: new Date('2026-11-23T10:00:00Z'), serviceType: 'Комплексная', priceRub: 45000, completedAt: new Date(),
    discountPercent: null, discountRub: null, paidRub: null, paymentMethod: null, workItems: [] as any[],
    handover: { issuedAt: new Date('2026-11-23T17:00:00Z'), issuedBy: { id: 3, fullName: 'Мастер' }, mileageKm: null, fuelPercent: null, warrantyBookIssued: true, warrantyTermsExplained: true, warrantyMonths: 12, warrantyStartsAt: new Date('2026-11-23'), warrantyTerms: null, careRecommendations: 'Мойка раз в 6 месяцев' } as any,
    user: { id: 1, phone: '+79990001122', lastName: 'Иванов', firstName: 'Иван', patronymic: null, birthDate: complete ? new Date('1990-05-01') : null },
    vehicle: { id: 4, carId: 5, customLabel: null, year: 2019, vin: 'XWEHN512BK0123456', plate: 'А123ВС77', car: { model: 'Rio', brand: { name: 'Kia' } } },
    inspection: {
      id: 1, receivedAt: new Date('2026-11-22T10:20:00Z'), receivedById: 3, mileageKm: 120000, fuelPercent: 40, keysCount: 2, noDefectsConfirmed: true,
      interior: Object.fromEntries(INTERIOR_KEYS.map((k) => [k, 'NONE'])), systems: Object.fromEntries(SYSTEM_KEYS.map((k) => [k, { status: 'OK' }])),
      dataVerifiedAt: new Date(), marks: [],
    },
  };
  const docs: any[] = [];
  const counters: Record<string, number> = {};
  let docId = 0, verId = 0;
  const versionsOf = (d: any) => [...d.versions].sort((a, b) => b.version - a.version);
  const prisma: any = {
    visitHistory: {
      findUnique: jest.fn(async () => ({ ...visit, documents: docs.map((d) => ({ ...d, versions: versionsOf(d) })) })),
      update: jest.fn(async ({ data }: any) => Object.assign(visit, data)),
    },
    branch: { findUniqueOrThrow: jest.fn(async () => ({ location: visit.location, city: 'Раменское', address: 'Гостица', docPrefix: 'Р' })) },
    organization: { findUniqueOrThrow: jest.fn(async () => ({ fullName: 'ИП Стражников А.Л.', brandName: 'АванКор', inn: '504032243409', ogrnip: '321508100480776', legalAddress: 'L', phone: 'P', email: 'E', signerName: 'Стражников А.Л.' })) },
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('FOR UPDATE')) return [{ docNumber: visit.docNumber, docDate: visit.docDate }];
      counters[values[0] as string] = (counters[values[0] as string] ?? 0) + 1;
      return [{ lastSeq: counters[values[0] as string] }];
    }),
    document: {
      upsert: jest.fn(async ({ where, create }: any) => {
        let d = docs.find((x) => x.visitId === where.visitId_kind.visitId && x.kind === where.visitId_kind.kind);
        if (!d) docs.push((d = { id: ++docId, ...create, versions: [] }));
        return d;
      }),
    },
    documentVersion: {
      create: jest.fn(async ({ data }: any) => {
        const d = docs.find((x) => x.id === data.documentId);
        const v = { id: ++verId, status: 'READY', formedAt: new Date(), signedAt: null, signedBy: null, scanKey: null, voidedAt: null, voidedBy: null, voidReason: null, ...data };
        d.versions.push(v);
        return v;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        for (const d of docs) for (const v of d.versions) {
          if (v.documentId === where.documentId && v.status === where.status && (!where.NOT || v.id !== where.NOT.id)) Object.assign(v, data);
        }
      }),
      update: jest.fn(async ({ where, data }: any) => {
        for (const d of docs) for (const v of d.versions) if (v.id === where.id) return Object.assign(v, data);
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        for (const d of docs) for (const v of d.versions) if (v.id === where.id && d.visitId === where.document.visitId) return v;
        return null;
      }),
    },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
  };
  const storage: any = { publicUrl: (k: string) => `https://cdn/${k}`, put: jest.fn(), remove: jest.fn() };
  const audit: any = { log: jest.fn(async () => undefined) };
  const inspection: any = { get: jest.fn(async () => ({ visitId: 7, started: true, readiness: { complete: true, missing: [] }, marks: [], photos: [] })) };
  const svc = new CrmDocumentsService(prisma, storage, audit, inspection);
  return { svc, prisma, storage, audit, visit, docs, counters };
}

const state = async (svc: CrmDocumentsService, kind: string) => (await svc.list(7)).documents.find((d) => d.kind === kind)!;

describe('CrmDocumentsService', () => {
  it('до формирования: «не сформирован» или «недостаточно данных» с перечнем', async () => {
    const ok = setup();
    expect((await state(ok.svc, 'CONTRACT')).status).toBe('NOT_FORMED');
    const bad = setup({ complete: false });
    const c = await state(bad.svc, 'CONTRACT');
    expect(c.status).toBe('INSUFFICIENT_DATA');
    expect(c.missing.map((m) => m.label)).toEqual(['Дата рождения клиента']);
  });

  it('нельзя сформировать окончательный документ без данных: ответ содержит точный список', async () => {
    const { svc, prisma } = setup({ complete: false });
    await expect(svc.form(7, 'CONTRACT', false, req)).rejects.toMatchObject({
      response: { missing: [expect.objectContaining({ label: 'Дата рождения клиента' })] },
    });
    expect(prisma.documentVersion.create).not.toHaveBeenCalled();
  });

  it('первое формирование выдаёт единый номер с префиксом филиала; остальные документы получают тот же', async () => {
    const { svc, visit, counters } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    expect(visit.docNumber).toBe('Р-000001');
    expect(visit.docDate).toBeInstanceOf(Date);
    await svc.form(7, 'ACCEPTANCE', false, req);
    expect(visit.docNumber).toBe('Р-000001');
    expect(counters['Р']).toBe(1);
    const v = await svc.getVersion(7, (await state(svc, 'ACCEPTANCE')).currentVersionId!);
    expect(v.snapshot.number).toBe('Р-000001');
    expect(v.snapshot.issuer.title).toBe('ИП Стражников А.Л. ; АванКор Раменское');
  });

  it('номера разных записей одного филиала идут подряд', async () => {
    const a = setup(); await a.svc.form(7, 'CONTRACT', false, req);
    a.counters['Р'] = 124; // как будто уже выдано 124 номера
    a.visit.docNumber = null;
    await a.svc.form(7, 'CONTRACT', false, req);
    expect(a.visit.docNumber).toBe('Р-000125');
  });

  it('повторное формирование неподписанного создаёт версию 2, а версия 1 аннулируется', async () => {
    const { svc } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    await svc.form(7, 'CONTRACT', false, req);
    const s = await state(svc, 'CONTRACT');
    expect(s.versions.map((v) => [v.version, v.status])).toEqual([[2, 'READY'], [1, 'VOID']]);
    expect(s.versions[1].voidReason).toBe('Заменён версией 2');
    expect(s.status).toBe('READY');
  });

  it('подписанный документ не пересоздаётся без явной исправленной версии', async () => {
    const { svc } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    await svc.sign(7, (await state(svc, 'CONTRACT')).currentVersionId!, undefined, req);
    await expect(svc.form(7, 'CONTRACT', false, req)).rejects.toThrow('подписан');
  });

  it('исправленная версия не трогает подписанную; после подписания новой старая заменяется', async () => {
    const { svc } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    await svc.sign(7, (await state(svc, 'CONTRACT')).currentVersionId!, undefined, req);
    await svc.form(7, 'CONTRACT', true, req);
    let s = await state(svc, 'CONTRACT');
    expect(s.versions.map((v) => [v.version, v.status])).toEqual([[2, 'READY'], [1, 'SIGNED']]);
    await svc.sign(7, s.currentVersionId!, undefined, req);
    s = await state(svc, 'CONTRACT');
    expect(s.versions.map((v) => [v.version, v.status])).toEqual([[2, 'SIGNED'], [1, 'VOID']]);
  });

  it('снимок версии не меняется после правки карточки клиента и автомобиля', async () => {
    const { svc, visit } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    const id = (await state(svc, 'CONTRACT')).currentVersionId!;
    await svc.sign(7, id, undefined, req);
    visit.user.lastName = 'Петров';
    visit.vehicle.vin = 'ZZZZZZZZZZZZZZZZZ';
    visit.priceRub = 1;
    const snap = (await svc.getVersion(7, id)).snapshot;
    expect(snap.client.lastName).toBe('Иванов');
    expect(snap.vehicle!.vin).toBe('XWEHN512BK0123456');
    expect(snap.visit.priceRub).toBe(45000);
  });

  it('подписать можно только готовую версию; чужая запись — 404', async () => {
    const { svc } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    const id = (await state(svc, 'CONTRACT')).currentVersionId!;
    await svc.sign(7, id, undefined, req);
    await expect(svc.sign(7, id, undefined, req)).rejects.toThrow('готовую к подписанию');
    await expect(svc.getVersion(99, id)).rejects.toThrow('не найдена');
  });

  it('скан PDF сохраняется в хранилище и открывается по ссылке', async () => {
    const { svc, storage } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    const id = (await state(svc, 'CONTRACT')).currentVersionId!;
    await svc.sign(7, id, { buffer: Buffer.from('%PDF-1.4 test') } as never, req);
    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^documents\/7\/.+\.pdf$/), expect.anything(), 'application/pdf');
    const v = (await state(svc, 'CONTRACT')).versions[0];
    expect(v.status).toBe('SIGNED');
    expect(v.scanUrl).toMatch(/^https:\/\/cdn\/documents\/7\//);
  });

  it('аннулировать можно только неподписанную версию, причина обязательна на уровне API', async () => {
    const { svc } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    const id = (await state(svc, 'CONTRACT')).currentVersionId!;
    await svc.voidVersion(7, id, 'ошибка в данных', req);
    expect((await state(svc, 'CONTRACT')).status).toBe('NOT_FORMED');
    await svc.form(7, 'CONTRACT', false, req);
    const id2 = (await state(svc, 'CONTRACT')).currentVersionId!;
    await svc.sign(7, id2, undefined, req);
    await expect(svc.voidVersion(7, id2, 'передумали', req)).rejects.toThrow('не подписанную');
  });

  it('предпросмотр ничего не сохраняет и не расходует номер', async () => {
    const { svc, prisma, visit, counters } = setup({ complete: false });
    const d = await svc.draft(7, 'CONTRACT');
    expect(d.draft).toBe(true);
    expect(d.number).toBeNull();
    expect(d.missing.map((m) => m.label)).toEqual(['Дата рождения клиента']);
    expect(d.issuer.city).toBe('Раменское');
    expect(prisma.documentVersion.create).not.toHaveBeenCalled();
    expect(visit.docNumber).toBeNull();
    expect(counters).toEqual({});
  });

  it('акт выполненных работ открывается только после договора и акта приёма', async () => {
    const { svc } = setup();
    expect((await state(svc, 'WORKS')).status).toBe('INSUFFICIENT_DATA');
    await svc.form(7, 'CONTRACT', false, req);
    await svc.form(7, 'ACCEPTANCE', false, req);
    expect((await state(svc, 'WORKS')).status).toBe('NOT_FORMED');
  });

  it('акт работ: пока работа не выполнена или нет выдачи, формировать нельзя', async () => {
    const { svc, visit } = setup();
    const category = { name: 'Диагностика', groups: [] };
    visit.workItems = [{ id: 1, kind: 'AGREED', status: 'IN_PROGRESS', categoryId: 5, category, selections: {}, comment: 'Осмотр', priceRub: 100, sortOrder: 1, master: null, photos: [] }];
    await svc.form(7, 'CONTRACT', false, req);
    await svc.form(7, 'ACCEPTANCE', false, req);
    expect((await state(svc, 'WORKS')).missing.map((m) => m.label)).toEqual(['Работа не завершена: Диагностика']);
    visit.workItems[0].status = 'DONE';
    visit.handover = null;
    expect((await state(svc, 'WORKS')).missing.map((m) => m.label)).toContain('Фактические дата и время выдачи автомобиля');
  });

  it('снимок акта работ содержит фактическое выполнение, допработы с согласованием, выдачу и фактическую стоимость', async () => {
    const { svc, visit } = setup();
    const category = { name: 'Антикоррозийная обработка', groups: [{ key: 'kind', sortOrder: 1 }] };
    const master = { id: 3, fullName: 'Мастер Иван' };
    visit.workItems = [
      { id: 1, kind: 'AGREED', status: 'DONE', categoryId: 1, category, selections: { kind: ['Базовая обработка'] }, comment: null, priceRub: 40000, sortOrder: 1,
        master, startedAt: new Date('2026-11-22T11:00:00Z'), finishedAt: new Date('2026-11-23T15:00:00Z'), actualVolume: 'Днище и арки', workNote: null, defectPlace: null, approvalStatus: null, photos: [{ stage: 'WORK_BEFORE' }, { stage: 'WORK_AFTER' }, { stage: 'WORK_AFTER' }] },
      { id: 2, kind: 'EXTRA', status: 'DONE', categoryId: 1, category, selections: { kind: ['Локальная обработка'] }, comment: 'Сквозная коррозия порога', priceRub: 5000, sortOrder: 2,
        master, startedAt: new Date('2026-11-23T09:00:00Z'), finishedAt: new Date('2026-11-23T12:00:00Z'), actualVolume: null, workNote: null, defectPlace: 'Порог правый', approvalStatus: 'APPROVED', approvedAt: new Date('2026-11-23T08:30:00Z'), approvedBy: 'anna', approvalChannel: 'PHONE', approvalNote: 'Звонок 08:30', photos: [] },
      { id: 3, kind: 'EXTRA', status: 'CANCELLED', categoryId: 1, category, selections: {}, comment: 'Замена арки', priceRub: 30000, sortOrder: 3,
        master: null, startedAt: null, finishedAt: null, actualVolume: null, workNote: 'Клиент отказался', defectPlace: null, approvalStatus: 'REJECTED', approvedAt: null, approvedBy: null, approvalChannel: 'PHONE', approvalNote: null, photos: [] },
    ];
    visit.discountPercent = 10;
    visit.paidRub = 10000;
    await svc.form(7, 'CONTRACT', false, req);
    await svc.form(7, 'ACCEPTANCE', false, req);
    await svc.form(7, 'WORKS', false, req);
    const snap: any = (await svc.getVersion(7, (await state(svc, 'WORKS')).currentVersionId!)).snapshot;
    // фактическая стоимость: основные 40000 + согласованная допработа 5000 (отказанная не входит) − скидка 10%
    expect(snap.pricing.actual).toMatchObject({ main: 40000, extras: 5000, gross: 45000, discountRub: 4500, total: 40500, paidRub: 10000, remaining: 30500 });
    expect(snap.pricing.preliminary).toBe(40000); // в договоре осталась стоимость, согласованная до работ
    expect(snap.execution.startedAt).toBe('2026-11-22T11:00:00.000Z');
    expect(snap.execution.finishedAt).toBe('2026-11-23T15:00:00.000Z');
    expect(snap.execution.items.map((i: any) => [i.kind, i.status])).toEqual([['AGREED', 'DONE'], ['EXTRA', 'DONE'], ['EXTRA', 'CANCELLED']]);
    expect(snap.execution.items[0]).toMatchObject({ masterName: 'Мастер Иван', actualVolume: 'Днище и арки', photosBefore: 1, photosAfter: 2 });
    expect(snap.execution.items[1].approval).toMatchObject({ status: 'APPROVED', channel: 'PHONE', approvedBy: 'anna', note: 'Звонок 08:30' });
    expect(snap.handover).toMatchObject({ issuedByName: 'Мастер', warrantyBookIssued: true, warrantyMonths: 12, careRecommendations: 'Мойка раз в 6 месяцев' });
    expect(snap.works.map((w: any) => w.id)).toEqual([1]); // в перечне договора — только согласованное до работ
  });

  it('снимок договора содержит перечень работ и предварительную стоимость со скидкой и остатком', async () => {
    const { svc, visit } = setup();
    const category = { name: 'Антикоррозийная обработка', groups: [{ key: 'kind', sortOrder: 1 }, { key: 'zones', sortOrder: 2 }] };
    const base = { kind: 'AGREED', status: 'WAITING', category, master: null, photos: [], approvalStatus: null };
    visit.workItems = [
      { ...base, id: 1, categoryId: 1, selections: { kind: ['Комплексная обработка'], zones: ['Днище'] }, comment: 'Без снятия колёс', priceRub: 30000, sortOrder: 1 },
      { ...base, id: 2, categoryId: 1, selections: { kind: ['Локальная обработка'] }, comment: null, priceRub: 10000, sortOrder: 2 },
    ];
    visit.discountPercent = 10;
    visit.paidRub = 5000;
    visit.paymentMethod = 'CARD_SBP';
    await svc.form(7, 'CONTRACT', false, req);
    const snap = (await svc.getVersion(7, (await state(svc, 'CONTRACT')).currentVersionId!)).snapshot;
    expect(snap.works.map((w) => w.title)).toEqual([
      'Антикоррозийная обработка: Комплексная обработка; зоны: Днище',
      'Антикоррозийная обработка: Локальная обработка',
    ]);
    expect(snap.works[0]).toMatchObject({ comment: 'Без снятия колёс', priceRub: 30000 });
    expect(snap.pricing).toMatchObject({ preliminary: 40000, discountPercent: 10, discountRub: 4000, agreedTotal: 36000, paidRub: 5000, remaining: 31000, paymentMethod: 'CARD_SBP' });
    expect(snap.schemaVersion).toBe(3);
  });

  it('позиция без цены не даёт сформировать договор', async () => {
    const { svc, visit } = setup();
    const category = { name: 'Диагностика', groups: [] };
    visit.workItems = [{ id: 1, kind: 'AGREED', status: 'WAITING', categoryId: 5, category, selections: {}, comment: 'Осмотр', priceRub: null, sortOrder: 1, master: null, photos: [], approvalStatus: null }];
    await expect(svc.form(7, 'CONTRACT', false, req)).rejects.toMatchObject({
      response: { missing: [expect.objectContaining({ label: 'Стоимость каждой работы в перечне' })] },
    });
  });

  it('действия попадают в журнал', async () => {
    const { svc, audit } = setup();
    await svc.form(7, 'CONTRACT', false, req);
    await svc.sign(7, (await state(svc, 'CONTRACT')).currentVersionId!, undefined, req);
    expect(audit.log.mock.calls.map((c: any[]) => [c[0].action, c[0].actor])).toEqual([['DOCUMENT_FORMED', 'anna'], ['DOCUMENT_SIGNED', 'anna']]);
  });
});
