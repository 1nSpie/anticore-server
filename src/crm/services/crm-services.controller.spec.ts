import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminJwtGuard } from '../../auth/admin-jwt.guard';
import { CrmServiceCatalogController, CrmWorkItemsController } from './crm-services.controller';
import { CrmServicesService } from './crm-services.service';

describe('услуги и перечень работ (HTTP)', () => {
  let app: INestApplication;
  const svc = {
    catalog: jest.fn(async () => []), addOption: jest.fn(async () => ({})), updateOption: jest.fn(async () => ({})),
    listWorks: jest.fn(async () => ({})), addWork: jest.fn(async () => ({})), updateWork: jest.fn(async () => ({})),
    deleteWork: jest.fn(async () => ({})), updatePricing: jest.fn(async () => ({})),
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [CrmServiceCatalogController, CrmWorkItemsController], providers: [{ provide: CrmServicesService, useValue: svc }] })
      .overrideGuard(AdminJwtGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());
  const http = () => request(app.getHttpServer());
  const arg = (fn: jest.Mock, call = 0, n = 1) => (fn.mock.calls[call] as unknown[])[n] as any;

  it('справочник: all=1 включает отключённые значения', async () => {
    await http().get('/crm/services/catalog').expect(200);
    expect(svc.catalog).toHaveBeenLastCalledWith(false);
    await http().get('/crm/services/catalog?all=1').expect(200);
    expect(svc.catalog).toHaveBeenLastCalledWith(true);
  });

  it('новый вариант справочника: название обязательно', async () => {
    await http().post('/crm/services/groups/3/options').send({}).expect(400);
    await http().post('/crm/services/groups/3/options').send({ name: 'Экспресс' }).expect(201);
    expect(svc.addOption).toHaveBeenCalledWith(3, 'Экспресс', expect.anything());
    await http().patch('/crm/services/options/9').send({ active: 'нет' }).expect(400);
    await http().patch('/crm/services/options/9').send({ active: false }).expect(200);
  });

  it('позиция работ: цена null остаётся null (не превращается в 0), 0 остаётся 0', async () => {
    await http().post('/crm/appointments/7/works').send({ categoryId: 1, selections: { kind: ['x'] }, priceRub: null }).expect(201);
    expect(arg(svc.addWork, 0, 1).priceRub).toBeNull();
    await http().post('/crm/appointments/7/works').send({ categoryId: 1, selections: { kind: ['x'] }, priceRub: 0 }).expect(201);
    expect(arg(svc.addWork, 1, 1).priceRub).toBe(0);
    await http().post('/crm/appointments/7/works').send({ categoryId: 1, selections: { kind: ['x'] } }).expect(201);
    expect(arg(svc.addWork, 2, 1).priceRub).toBeUndefined();
  });

  it('позиция работ: отрицательная цена, нет категории, параметры не объектом — 400', async () => {
    const post = (b: object) => http().post('/crm/appointments/7/works').send(b);
    await post({ categoryId: 1, selections: {}, priceRub: -5 }).expect(400);
    await post({ selections: {} }).expect(400);
    await post({ categoryId: 1, selections: 'x' }).expect(400);
    expect(svc.addWork).not.toHaveBeenCalled();
  });

  it('изменение и удаление позиции: причина согласования передаётся в сервис', async () => {
    await http().patch('/crm/appointments/7/works/4').send({ priceRub: 100, reason: 'Согласовано по телефону' }).expect(200);
    expect(arg(svc.updateWork, 0, 2)).toEqual({ priceRub: 100, reason: 'Согласовано по телефону' });
    await http().delete('/crm/appointments/7/works/4?reason=Клиент%20отказался').expect(200);
    expect(svc.deleteWork).toHaveBeenCalledWith(7, 4, 'Клиент отказался', expect.anything());
  });

  it('стоимость: скидка/оплата принимают null, способ оплаты проверяется', async () => {
    await http().put('/crm/appointments/7/pricing').send({ discountPercent: null, paidRub: 5000, paymentMethod: 'CARD_SBP' }).expect(200);
    const dto = arg(svc.updatePricing, 0, 1);
    expect(dto.discountPercent).toBeNull();
    expect(dto.paidRub).toBe(5000);
    await http().put('/crm/appointments/7/pricing').send({ paymentMethod: 'BITCOIN' }).expect(400);
    await http().put('/crm/appointments/7/pricing').send({ paidRub: -1 }).expect(400);
  });
});
