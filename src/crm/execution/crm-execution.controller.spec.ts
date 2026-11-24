import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminJwtGuard } from '../../auth/admin-jwt.guard';
import { CrmExecutionController } from './crm-execution.controller';
import { CrmExecutionService } from './crm-execution.service';

describe('выполнение и выдача (HTTP)', () => {
  let app: INestApplication;
  const svc = {
    get: jest.fn(async () => ({})), updateItem: jest.fn(async () => ({})), addExtra: jest.fn(async () => ({})),
    updateExtra: jest.fn(async () => ({})), decideExtra: jest.fn(async () => ({})), deleteExtra: jest.fn(async () => ({})),
    addPhoto: jest.fn(async () => ({})), deletePhoto: jest.fn(async () => ({})), getHandover: jest.fn(async () => ({})), updateHandover: jest.fn(async () => ({})),
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [CrmExecutionController], providers: [{ provide: CrmExecutionService, useValue: svc }] })
      .overrideGuard(AdminJwtGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());
  const http = () => request(app.getHttpServer());
  const arg = (fn: jest.Mock, n = 2, call = 0) => (fn.mock.calls[call] as unknown[])[n] as any;
  const base = '/crm/appointments/7';

  it('статус работы проверяется, мастер null сохраняется как null', async () => {
    await http().patch(`${base}/execution/items/3`).send({ status: 'FLYING' }).expect(400);
    await http().patch(`${base}/execution/items/3`).send({ status: 'DONE', masterId: null, actualVolume: 'Днище' }).expect(200);
    expect(arg(svc.updateItem)).toEqual({ status: 'DONE', masterId: null, actualVolume: 'Днище' });
  });

  it('допработа: описание дефекта обязательно, лишние поля отбрасываются', async () => {
    const post = (b: object) => http().post(`${base}/execution/extras`).send(b);
    await post({ categoryId: 1, selections: {}, comment: 'ab' }).expect(400);
    await post({ categoryId: 1, selections: {} }).expect(400);
    await post({ categoryId: 1, selections: {}, comment: 'Сквозная коррозия', priceRub: -1 }).expect(400);
    await post({ categoryId: 1, selections: {}, comment: 'Сквозная коррозия', priceRub: 5000, evil: 1 }).expect(201);
    expect(arg(svc.addExtra, 1)).toEqual({ categoryId: 1, selections: {}, comment: 'Сквозная коррозия', priceRub: 5000 });
  });

  it('решение клиента: способ обязателен и проверяется', async () => {
    const post = (b: object) => http().post(`${base}/execution/extras/4/decision`).send(b);
    await post({ decision: 'APPROVED' }).expect(400);
    await post({ decision: 'MAYBE', channel: 'PHONE' }).expect(400);
    await post({ decision: 'APPROVED', channel: 'TELEPATHY' }).expect(400);
    await post({ decision: 'APPROVED', channel: 'MESSENGER', note: 'WhatsApp', approvedAt: '2026-11-22T14:05:00.000Z' }).expect(201);
    expect(svc.decideExtra).toHaveBeenCalledTimes(1);
  });

  it('фото: этап «до/после» обязателен', async () => {
    const photo = (stage?: string) => {
      const r = http().post(`${base}/execution/items/3/photos`);
      if (stage) r.field('stage', stage);
      return r.attach('file', Buffer.from('x'), 'a.jpg');
    };
    await photo().expect(400);
    await photo('RECEPTION').expect(400);
    await photo('WORK_BEFORE').expect(201);
    expect(arg(svc.addPhoto, 2)).toBe('WORK_BEFORE');
    await http().delete(`${base}/execution/items/3/photos/9`).expect(200);
    expect(svc.deletePhoto).toHaveBeenCalledWith(7, 3, 9, expect.anything());
  });

  it('выдача: допускает null, проверяет типы', async () => {
    await http().put(`${base}/handover`).send({ issuedAt: '2026-11-23T17:00:00.000Z', warrantyBookIssued: true, warrantyMonths: 24, mileageKm: null }).expect(200);
    expect(arg(svc.updateHandover, 1)).toEqual({ issuedAt: '2026-11-23T17:00:00.000Z', warrantyBookIssued: true, warrantyMonths: 24, mileageKm: null });
    await http().put(`${base}/handover`).send({ warrantyBookIssued: 'да' }).expect(400);
    await http().put(`${base}/handover`).send({ issuedAt: 'вчера' }).expect(400);
    await http().get(`${base}/handover`).expect(200);
  });
});
