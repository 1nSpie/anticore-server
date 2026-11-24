import { checkInt, parseInterior, parseSystems } from './inspection.rules';

describe('правила данных приёмки', () => {
  it('parseSystems принимает три статуса и обрезает комментарий', () => {
    const r = parseSystems({ lights: { status: 'FAULTY', note: '  '.concat('x'.repeat(400)) }, horn: { status: 'NOT_CHECKED' } });
    expect(r.lights!.status).toBe('FAULTY');
    expect(r.lights!.note).toHaveLength(300);
    expect(r.horn).toEqual({ status: 'NOT_CHECKED' });
  });
  it('parseSystems отклоняет неизвестные ключи и статусы', () => {
    expect(() => parseSystems({ engine: { status: 'OK' } })).toThrow('Неизвестная система');
    expect(() => parseSystems({ lights: { status: 'FINE' } })).toThrow('Некорректный статус');
    expect(() => parseSystems([])).toThrow();
  });
  it('parseInterior принимает только NONE/PRESENT', () => {
    expect(parseInterior({ dirt: 'PRESENT', smell: 'NONE' })).toEqual({ dirt: 'PRESENT', smell: 'NONE' });
    expect(() => parseInterior({ dirt: 'MAYBE' })).toThrow('Некорректное значение');
    expect(() => parseInterior({ seats: 'NONE' })).toThrow('Неизвестный пункт');
  });
  it('checkInt проверяет границы', () => {
    expect(checkInt(100, 0, 100, 'Топливо')).toBe(100);
    expect(() => checkInt(101, 0, 100, 'Топливо')).toThrow('Топливо');
    expect(() => checkInt(1.5, 0, 100, 'Топливо')).toThrow();
  });
});
