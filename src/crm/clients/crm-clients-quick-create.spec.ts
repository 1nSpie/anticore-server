import { assertQuickCreateComplete } from './crm-clients.service';
import { CreateCrmClientDto } from './dto/crm-client.dto';

const full = (): CreateCrmClientDto => ({
  phone: '+79990001122', lastName: 'Иванов', firstName: 'Иван', carId: 5, year: 2019,
});

describe('quick client creation: required fields', () => {
  it('passes without a patronymic (it is optional)', () => {
    expect(() => assertQuickCreateComplete(full())).not.toThrow();
  });

  it('accepts a free-text car instead of a catalog car', () => {
    const dto = { ...full(), carId: undefined, customCar: 'Moskvich 412' };
    expect(() => assertQuickCreateComplete(dto)).not.toThrow();
  });

  it('lists every missing field at once', () => {
    const dto = { phone: '+79990001122' } as CreateCrmClientDto;
    expect(() => assertQuickCreateComplete(dto)).toThrow(
      'Не заполнено: фамилия, имя, марка и модель, год выпуска',
    );
  });

  it('does not accept blank strings as filled', () => {
    expect(() => assertQuickCreateComplete({ ...full(), lastName: '   ' })).toThrow('фамилия');
  });

  it('requires the year', () => {
    expect(() => assertQuickCreateComplete({ ...full(), year: undefined })).toThrow('год выпуска');
  });
});
