import { validate } from 'class-validator';
import { CrmAppointmentsService } from './crm-appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

describe('Appointment master comment', () => {
  const initial = {
    id: 1, userId: 1, vehicleId: null, visitDate: new Date('2026-10-01T07:00:00Z'),
    startsAt: new Date('2026-10-01T07:00:00Z'), endsAt: new Date('2026-10-01T08:00:00Z'),
    serviceType: 'Осмотр', serviceTypeId: null, priceRub: 0, managerName: null,
    masterComment: null as string | null, location: 'ZHUKOVSKY', user: { id: 1, phone: 'test' },
  };
  let row: typeof initial;
  let service: CrmAppointmentsService;
  beforeEach(() => {
    row = { ...initial };
    const prisma = {
      cabinetUser: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      visitHistory: {
        findUnique: jest.fn(async () => row),
        findMany: jest.fn(async () => [row]),
        create: jest.fn(async ({ data }) => (row = { ...row, ...data })),
        update: jest.fn(async ({ data }) => (row = { ...row, ...data })),
      },
    };
    service = new CrmAppointmentsService(
      prisma as never, { sendAppointmentSms: jest.fn() } as never, {} as never,
      { assertDayCapacity: jest.fn() } as never,
      { listForUser: jest.fn().mockResolvedValue([]) } as never,
    );
  });
  it('returns a saved multiline comment when the calendar is loaded again', async () => {
    await service.create({ clientId: 1, startsAt: initial.startsAt.toISOString(), endsAt: initial.endsAt.toISOString(), serviceType: 'Осмотр', priceRub: 0, masterComment: '  Проверить пороги\nСогласовать работы  ' });
    expect((await service.list())[0].masterComment).toBe('Проверить пороги\nСогласовать работы');
  });
  it('preserves the comment on a time-only update and permits editing and clearing it', async () => {
    await service.update(1, { masterComment: 'Заметка' });
    await service.update(1, { startsAt: initial.startsAt.toISOString() });
    expect((await service.list())[0].masterComment).toBe('Заметка');
    expect((await service.update(1, { masterComment: 'Исправлено' })).masterComment).toBe('Исправлено');
    expect((await service.update(1, { masterComment: null })).masterComment).toBeNull();
    expect((await service.update(1, { masterComment: '  ' })).masterComment).toBeNull();
  });
  it.each([CreateAppointmentDto, UpdateAppointmentDto])('validates comment type and length for %p', async (Dto) => {
    for (const value of [123, 'x'.repeat(2001)]) {
      const errors = await validate(Object.assign(new Dto(), { masterComment: value }));
      expect(errors.some(error => error.property === 'masterComment')).toBe(true);
    }
    const errors = await validate(Object.assign(new Dto(), { masterComment: 'x'.repeat(2000) }));
    expect(errors.some(error => error.property === 'masterComment')).toBe(false);
  });
});
