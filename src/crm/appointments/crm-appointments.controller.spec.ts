import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminJwtGuard } from '../../auth/admin-jwt.guard';
import { CrmAppointmentsController } from './crm-appointments.controller';
import { CrmAppointmentsService } from './crm-appointments.service';

describe('CrmAppointmentsController: запись по id (HTTP)', () => {
  let app: INestApplication;
  const svc = { list: jest.fn(async () => []), search: jest.fn(async () => []), get: jest.fn(async (id: number) => ({ id })) };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [CrmAppointmentsController], providers: [{ provide: CrmAppointmentsService, useValue: svc }] })
      .overrideGuard(AdminJwtGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('GET /:id отдаёт одну запись для страницы с прямой ссылкой', async () => {
    const res = await request(app.getHttpServer()).get('/crm/appointments/42').expect(200);
    expect(res.body).toEqual({ id: 42 });
    expect(svc.get).toHaveBeenCalledWith(42);
  });

  it('«search» по-прежнему ищет, а не воспринимается как id', async () => {
    await request(app.getHttpServer()).get('/crm/appointments/search?q=999').expect(200);
    expect(svc.search).toHaveBeenCalledWith('999');
    expect(svc.get).not.toHaveBeenCalled();
  });

  it('нечисловой id — 400', async () => {
    await request(app.getHttpServer()).get('/crm/appointments/abc').expect(400);
  });
});
