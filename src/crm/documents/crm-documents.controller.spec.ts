import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminJwtGuard } from '../../auth/admin-jwt.guard';
import { CrmDocumentsController } from './crm-documents.controller';
import { CrmDocumentsService } from './crm-documents.service';

describe('CrmDocumentsController (HTTP)', () => {
  let app: INestApplication;
  const svc = {
    list: jest.fn(async () => ({})), draft: jest.fn(async () => ({})), form: jest.fn(async () => ({})),
    getVersion: jest.fn(async () => ({})), sign: jest.fn(async () => ({})), voidVersion: jest.fn(async () => ({})),
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [CrmDocumentsController], providers: [{ provide: CrmDocumentsService, useValue: svc }] })
      .overrideGuard(AdminJwtGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());
  const http = () => request(app.getHttpServer());

  it('список, черновик и формирование маршрутизируются по виду документа', async () => {
    await http().get('/crm/appointments/5/documents').expect(200);
    await http().get('/crm/appointments/5/documents/ACCEPTANCE/draft').expect(200);
    expect(svc.draft).toHaveBeenCalledWith(5, 'ACCEPTANCE');
    await http().post('/crm/appointments/5/documents/CONTRACT').send({ correction: true }).expect(201);
    expect((svc.form.mock.calls[0] as unknown[]).slice(0, 3)).toEqual([5, 'CONTRACT', true]);
    await http().post('/crm/appointments/5/documents/WORKS').send({}).expect(201);
    expect((svc.form.mock.calls[1] as unknown[]).slice(0, 3)).toEqual([5, 'WORKS', false]);
  });

  it('неизвестный вид документа и мусор в теле отклоняются', async () => {
    await http().get('/crm/appointments/5/documents/INVOICE/draft').expect(400);
    await http().post('/crm/appointments/5/documents/INVOICE').send({}).expect(400);
    await http().post('/crm/appointments/5/documents/CONTRACT').send({ correction: 'yes' }).expect(400);
    expect(svc.form).not.toHaveBeenCalled();
  });

  it('версия открывается по номеру, а «versions» не принимается за вид документа', async () => {
    await http().get('/crm/appointments/5/documents/versions/9').expect(200);
    expect(svc.getVersion).toHaveBeenCalledWith(5, 9);
    expect(svc.draft).not.toHaveBeenCalled();
  });

  it('подписание принимает файл и работает без него', async () => {
    await http().post('/crm/appointments/5/documents/versions/9/sign').expect(201);
    expect((svc.sign.mock.calls[0] as unknown[])[2]).toBeUndefined();
    await http().post('/crm/appointments/5/documents/versions/9/sign').attach('file', Buffer.from('%PDF-1.4'), 'scan.pdf').expect(201);
    expect((svc.sign.mock.calls[1] as any[])[2].originalname).toBe('scan.pdf');
  });

  it('аннулирование требует причину', async () => {
    await http().post('/crm/appointments/5/documents/versions/9/void').send({ reason: 'нт' }).expect(400);
    await http().post('/crm/appointments/5/documents/versions/9/void').send({ reason: 'ошибка в данных' }).expect(201);
    expect(svc.voidVersion).toHaveBeenCalledTimes(1);
  });
});
