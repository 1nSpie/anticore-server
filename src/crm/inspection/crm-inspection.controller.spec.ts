import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminJwtGuard } from '../../auth/admin-jwt.guard';
import { CrmInspectionController } from './crm-inspection.controller';
import { CrmInspectionService } from './crm-inspection.service';

describe('CrmInspectionController (HTTP)', () => {
  let app: INestApplication;
  const svc = {
    get: jest.fn(async (id: number) => ({ visitId: id })),
    start: jest.fn(async (id: number) => ({ visitId: id })),
    update: jest.fn(async () => ({})),
    verify: jest.fn(async () => ({})),
    addMark: jest.fn(async () => ({})),
    updateMark: jest.fn(async () => ({})),
    deleteMark: jest.fn(async () => ({})),
    addPhoto: jest.fn(async () => ({})),
    deletePhoto: jest.fn(async () => ({})),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [CrmInspectionController], providers: [{ provide: CrmInspectionService, useValue: svc }] })
      .overrideGuard(AdminJwtGuard).useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('GET и POST start маршрутизируются с числовым id', async () => {
    await request(app.getHttpServer()).get('/crm/appointments/12/inspection').expect(200);
    expect(svc.get).toHaveBeenCalledWith(12);
    await request(app.getHttpServer()).post('/crm/appointments/12/inspection/start').expect(201);
    await request(app.getHttpServer()).get('/crm/appointments/abc/inspection').expect(400);
  });

  it('отметка: координаты вне 0..1, неизвестный тип и пустой элемент отклоняются до сервиса', async () => {
    const post = (body: object) => request(app.getHttpServer()).post('/crm/appointments/1/inspection/marks').send(body);
    await post({ type: 'DENT', x: 1.5, y: 0.2, element: 'Капот' }).expect(400);
    await post({ type: 'HOLE', x: 0.5, y: 0.2, element: 'Капот' }).expect(400);
    await post({ type: 'DENT', x: 0.5, y: 0.2 }).expect(400);
    expect(svc.addMark).not.toHaveBeenCalled();
    await post({ type: 'DENT', x: 0.5, y: 0.2, element: 'Капот' }).expect(201);
    expect(svc.addMark).toHaveBeenCalledTimes(1);
  });

  it('PATCH принимает частичные данные и отбрасывает лишние поля', async () => {
    await request(app.getHttpServer()).patch('/crm/appointments/1/inspection').send({ mileageKm: '1500', hacker: 1 }).expect(200);
    const dto = svc.update.mock.calls[0] as unknown as unknown[];
    expect(dto[1]).toEqual({ mileageKm: 1500 });
    await request(app.getHttpServer()).patch('/crm/appointments/1/inspection').send({ noDefectsConfirmed: 'yes' }).expect(400);
  });

  it('фото: markId приводится к числу, неверный раздел отклоняется', async () => {
    await request(app.getHttpServer()).post('/crm/appointments/1/inspection/photos').field('markId', '4').attach('file', Buffer.from('x'), 'a.jpg').expect(201);
    expect((svc.addPhoto.mock.calls[0] as unknown as unknown[])[2]).toEqual({ markId: 4 });
    await request(app.getHttpServer()).post('/crm/appointments/1/inspection/photos').field('section', 'ROOF').attach('file', Buffer.from('x'), 'a.jpg').expect(400);
  });
});
