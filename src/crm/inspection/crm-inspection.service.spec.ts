import { CrmInspectionService, MAX_VISIT_PHOTOS } from './crm-inspection.service';

const req = { admin: { id: 'staff:8', login: 'anna' }, headers: {} } as never;

function setup(over: { visit?: Record<string, unknown>; photoCount?: number } = {}) {
  const base = {
    id: 7, userId: 1, vehicleId: 4,
    user: { id: 1, phone: '+79990001122', lastName: 'Иванов', firstName: 'Иван', patronymic: null, birthDate: null },
    vehicle: { id: 4, carId: 5, customLabel: null, year: 2019, vin: 'XWEHN512BK0123456', plate: 'А123ВС77', car: { model: 'Rio', brand: { name: 'Kia' } } },
    assignees: [{ staff: { id: 3, fullName: 'Мастер' } }],
    inspection: null as null | Record<string, unknown>,
    photos: [] as unknown[],
  };
  const state = { ...base, ...over.visit };
  const insp = () => state.inspection;
  const prisma: any = {
    visitHistory: { findUnique: jest.fn(async () => state) },
    staff: { findUnique: jest.fn(async ({ where }: any) => (where.id === 3 ? { id: 3 } : null)) },
    vehicleInspection: {
      create: jest.fn(async ({ data }: any) => { state.inspection = { id: 1, marks: [], interior: null, systems: null, noDefectsConfirmed: false, dataVerifiedAt: null, receivedBy: null, ...data }; return state.inspection; }),
      update: jest.fn(async ({ data }: any) => { Object.assign(insp()!, data); return insp(); }),
    },
    inspectionMark: { create: jest.fn(async () => ({})), update: jest.fn(), delete: jest.fn() },
    visitPhoto: { count: jest.fn(async () => over.photoCount ?? 0), create: jest.fn(async () => ({})), findMany: jest.fn(async () => []), findFirst: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
  };
  const storage: any = { publicUrl: (k: string) => `https://cdn/${k}`, put: jest.fn(), remove: jest.fn() };
  const audit: any = { log: jest.fn(async () => undefined) };
  return { svc: new CrmInspectionService(prisma, storage, audit), prisma, storage, audit, state };
}

describe('CrmInspectionService', () => {
  it('«Начать приёмку» фиксирует факт приёма и подставляет единственного мастера; повтор ничего не меняет', async () => {
    const { svc, prisma } = setup();
    const r = await svc.start(7);
    expect(prisma.vehicleInspection.create).toHaveBeenCalledWith({ data: expect.objectContaining({ visitId: 7, receivedById: 3, receivedAt: expect.any(Date) }) });
    expect(r.started).toBe(true);
    await svc.start(7);
    expect(prisma.vehicleInspection.create).toHaveBeenCalledTimes(1);
  });

  it('не подставляет мастера, если назначено несколько', async () => {
    const two = [{ staff: { id: 3, fullName: 'А' } }, { staff: { id: 9, fullName: 'Б' } }];
    const { svc, prisma } = setup({ visit: { assignees: two } });
    await svc.start(7);
    expect(prisma.vehicleInspection.create).toHaveBeenCalledWith({ data: expect.objectContaining({ receivedById: null }) });
  });

  it('до начала приёмки редактировать нельзя', async () => {
    const { svc } = setup();
    await expect(svc.update(7, { mileageKm: 1 }, req)).rejects.toThrow('Приёмка ещё не начата');
  });

  it('проверяет границы пробега, топлива и ключей', async () => {
    const { svc } = setup(); await svc.start(7);
    await expect(svc.update(7, { fuelPercent: 120 }, req)).rejects.toThrow('Уровень топлива');
    await expect(svc.update(7, { mileageKm: -5 }, req)).rejects.toThrow('Пробег');
    await expect(svc.update(7, { keysCount: 50 }, req)).rejects.toThrow('ключей');
  });

  it('частичное обновление систем дополняет, а не затирает ранее отмеченное', async () => {
    const { svc, state } = setup(); await svc.start(7);
    await svc.update(7, { systems: { lights: { status: 'OK' } } }, req);
    await svc.update(7, { systems: { horn: { status: 'FAULTY', note: 'хрипит' } } }, req);
    expect(state.inspection!.systems).toEqual({ lights: { status: 'OK' }, horn: { status: 'FAULTY', note: 'хрипит' } });
  });

  it('«дефектов нет» нельзя подтвердить при наличии отметок; новая отметка снимает подтверждение', async () => {
    const { svc, prisma, state } = setup(); await svc.start(7);
    (state.inspection!.marks as unknown[]).push({ id: 1, type: 'DENT', x: 0.1, y: 0.1, element: 'Капот', note: null });
    await expect(svc.update(7, { noDefectsConfirmed: true }, req)).rejects.toThrow('нельзя');
    await svc.addMark(7, { type: 'SCRATCH', x: 0.5, y: 0.5, element: ' Капот ' });
    expect(prisma.inspectionMark.create).toHaveBeenCalledWith({ data: expect.objectContaining({ element: 'Капот', inspectionId: 1 }) });
    expect(prisma.vehicleInspection.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { noDefectsConfirmed: false } });
  });

  it('несуществующий мастер-приёмщик отклоняется', async () => {
    const { svc } = setup(); await svc.start(7);
    await expect(svc.update(7, { receivedById: 99 }, req)).rejects.toThrow('Мастер-приёмщик не найден');
  });

  it('подтверждение проверки: нельзя без госномера, иначе фиксирует кто и когда', async () => {
    const noPlate = { vehicle: { id: 4, carId: 5, customLabel: null, year: 2019, vin: 'XWEHN512BK0123456', plate: null, car: null } };
    const bad = setup({ visit: noPlate }); await bad.svc.start(7);
    await expect(bad.svc.verify(7, req)).rejects.toMatchObject({ response: { missing: [expect.objectContaining({ code: 'vehicle.plate' })] } });
    const good = setup(); await good.svc.start(7);
    const r = await good.svc.verify(7, req);
    expect(r.inspection!.dataVerifiedBy).toBe('anna');
    expect(r.inspection!.dataVerifiedAt).toBeInstanceOf(Date);
    expect(good.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'INSPECTION_VERIFIED', actor: 'anna' }));
  });

  it('фото к чужой отметке отклоняется, лимит фото соблюдается', async () => {
    const { svc } = setup(); await svc.start(7);
    await expect(svc.addPhoto(7, { buffer: Buffer.from('x') } as never, { markId: 55 }, req)).rejects.toThrow('Отметка не найдена');
    const full = setup({ photoCount: MAX_VISIT_PHOTOS }); await full.svc.start(7);
    await expect(full.svc.addPhoto(7, { buffer: Buffer.from('x') } as never, {}, req)).rejects.toThrow('не больше');
  });

  it('готовность в ответе показывает недостающее и становится полной после заполнения', async () => {
    const { svc } = setup(); const first = await svc.start(7);
    expect(first.readiness.complete).toBe(false);
    expect(first.readiness.missing.map((m) => m.code)).toEqual(expect.arrayContaining(['inspection.mileage', 'inspection.exterior', 'inspection.verified']));
  });
});
