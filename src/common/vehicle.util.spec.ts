import { normalizePlate, validatePlate, validateVehicleYear } from './vehicle.util';

describe('vehicle.util', () => {
  const now = new Date('2026-11-22T00:00:00Z');

  it('accepts a year from 1900 up to next year and rejects the rest', () => {
    expect(validateVehicleYear(2018, now)).toBe(2018);
    expect(validateVehicleYear(2027, now)).toBe(2027);
    for (const bad of [2028, 1899, 20.5, NaN]) {
      expect(() => validateVehicleYear(bad, now)).toThrow('Год выпуска');
    }
  });

  it('normalizes a plate: no spaces or hyphens, upper case', () => {
    expect(normalizePlate(' а123 вс-77 ')).toBe('А123ВС77');
    expect(validatePlate('a 123 bc 777')).toBe('А123ВС777'); // латиница → кириллица
  });

  it('приводит латиницу к кириллице только для российского формата', () => {
    expect(normalizePlate('A123AA211')).toBe('А123АА211');
    expect(normalizePlate('x777xx77')).toBe('Х777ХХ77');
    expect(normalizePlate('AB123CD')).toBe('AB123CD'); // иностранный номер не трогаем
    expect(normalizePlate('А123ВС77')).toBe('А123ВС77');
  });

  it('rejects a plate with special characters or wrong length', () => {
    expect(() => validatePlate('А1')).toThrow('Госномер');
    expect(() => validatePlate('А123ВС#77')).toThrow('Госномер');
  });
});
