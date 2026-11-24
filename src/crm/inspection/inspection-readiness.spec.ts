import { acceptanceMissing, cardMissing, type ReadinessInput } from './inspection-readiness';
import { INTERIOR_KEYS, SYSTEM_KEYS } from './inspection.rules';

const ok = (): ReadinessInput => ({
  client: { lastName: 'Иванов', firstName: 'Иван' },
  vehicle: { carId: 5, customLabel: null, year: 2019, vin: 'XWEHN512BK0123456', plate: 'А123ВС77' },
  inspection: {
    receivedAt: new Date(), receivedById: 3, mileageKm: 120000, fuelPercent: 40, keysCount: 2, noDefectsConfirmed: true,
    interior: Object.fromEntries(INTERIOR_KEYS.map((k) => [k, 'NONE'])),
    systems: Object.fromEntries(SYSTEM_KEYS.map((k) => [k, { status: 'OK' }])),
    dataVerifiedAt: new Date(),
  },
  marksCount: 0,
});
const codes = (i: ReadinessInput) => acceptanceMissing(i).map((m) => m.code);

describe('готовность акта приёма-передачи', () => {
  it('полностью заполненная приёмка — ничего не недостаёт', () => {
    expect(acceptanceMissing(ok())).toEqual([]);
  });

  it('без приёмки недостаёт самой приёмки', () => {
    expect(codes({ ...ok(), inspection: null })).toEqual(['inspection']);
  });

  it('пустая схема без подтверждения «дефектов нет» не считается исправным состоянием', () => {
    const i = ok();
    i.inspection!.noDefectsConfirmed = false;
    expect(codes(i)).toEqual(['inspection.exterior']);
    i.marksCount = 1; // есть отметки — подтверждение не нужно
    expect(codes(i)).toEqual([]);
  });

  it('система без выбора не считается исправной, «не проверялось» — допустимый выбор', () => {
    const i = ok();
    const systems = i.inspection!.systems as Record<string, unknown>;
    delete systems.horn;
    systems.fan = { status: 'NOT_CHECKED' };
    expect(codes(i)).toEqual(['inspection.systems.horn']);
  });

  it('салон: каждый пункт нужно отметить', () => {
    const i = ok();
    i.inspection!.interior = { dirt: 'NONE' };
    expect(codes(i)).toEqual(['inspection.interior.damage', 'inspection.interior.upholstery', 'inspection.interior.smell']);
  });

  it('перечисляет все недостающие поля сразу, с якорями для перехода', () => {
    const i = ok();
    i.inspection!.mileageKm = null;
    i.inspection!.fuelPercent = null;
    i.inspection!.keysCount = null;
    i.vehicle!.plate = null;
    const missing = acceptanceMissing(i);
    expect(missing.map((m) => m.label)).toEqual(['Государственный номер', 'Пробег', 'Уровень топлива', 'Количество ключей']);
    expect(missing.every((m) => m.field)).toBe(true);
  });

  it('VIN: пустой и некорректный различаются', () => {
    const i = ok();
    i.vehicle!.vin = null;
    expect(cardMissing(i)[0].label).toBe('VIN');
    i.vehicle!.vin = 'ABC';
    expect(cardMissing(i)[0].label).toBe('VIN указан некорректно');
  });

  it('проверка данных нужна для акта, но не для подтверждения (карточка)', () => {
    const i = ok();
    i.inspection!.dataVerifiedAt = null;
    expect(codes(i)).toEqual(['inspection.verified']);
    expect(cardMissing(i)).toEqual([]);
  });

  it('без автомобиля нельзя', () => {
    expect(cardMissing({ ...ok(), vehicle: null }).map((m) => m.code)).toEqual(['vehicle']);
  });
});
