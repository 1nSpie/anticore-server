import { CrmAppointmentsService } from './crm-appointments.service';
import { CrmClientsService } from '../clients/crm-clients.service';

describe('запись с оформленными документами защищена', () => {
  const visit = (docNumber: string | null) => ({
    id: 1, userId: 1, vehicleId: null, location: 'RAMENSKOYE', docNumber, serviceType: 'x',
    startsAt: new Date('2026-10-01T07:00:00Z'), endsAt: new Date('2026-10-01T08:00:00Z'), visitDate: new Date('2026-10-01T07:00:00Z'),
    user: { id: 1 }, workItems: [],
  });
  const appointments = (row: unknown) => {
    const prisma: any = {
      visitHistory: { findUnique: jest.fn(async () => row), update: jest.fn(), delete: jest.fn() },
      visitStaff: { findMany: jest.fn(async () => []) },
      siteLead: { updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const svc = new CrmAppointmentsService(prisma, {} as never, {} as never, { assertDayCapacity: jest.fn() } as never, { listForUser: jest.fn() } as never, { notify: jest.fn() } as never);
    return { svc, prisma };
  };

  it('после выдачи номера филиал менять нельзя', async () => {
    const { svc, prisma } = appointments(visit('Р-000001'));
    await expect(svc.update(1, { location: 'KOLOMNA' })).rejects.toThrow('филиал изменить нельзя');
    expect(prisma.visitHistory.update).not.toHaveBeenCalled();
  });

  it('тот же филиал в запросе не мешает правке', async () => {
    const { svc } = appointments(visit('Р-000001'));
    await expect(svc.update(1, { location: 'RAMENSKOYE' })).rejects.not.toThrow('филиал изменить нельзя');
  });

  it('запись с номером документов удалить нельзя', async () => {
    const { svc, prisma } = appointments(visit('Р-000001'));
    await expect(svc.remove(1)).rejects.toThrow('удалить её нельзя');
    expect(prisma.visitHistory.delete).not.toHaveBeenCalled();
  });

  it('запись без документов удаляется как раньше', async () => {
    const { svc, prisma } = appointments(visit(null));
    prisma.$transaction.mockResolvedValue([]);
    await expect(svc.remove(1)).resolves.toEqual({ message: 'Удалено' });
  });

  it('клиента с оформленными документами удалить нельзя', async () => {
    const prisma: any = {
      cabinetUser: { findUnique: jest.fn(async () => ({ id: 1 })), delete: jest.fn() },
      visitHistory: { count: jest.fn(async () => 2) },
    };
    const svc = new CrmClientsService(prisma, {} as never, {} as never, {} as never);
    await expect(svc.remove(1)).rejects.toThrow('удалить его нельзя');
    expect(prisma.cabinetUser.delete).not.toHaveBeenCalled();
    prisma.visitHistory.count.mockResolvedValue(0);
    await expect(svc.remove(1)).resolves.toEqual({ message: 'Удалено' });
  });

  describe('перечень работ — источник услуги и цены', () => {
    const run = async (workItems: { priceRub: number | null }[], dto: object) => {
      const row = { ...visit(null), priceRub: 500, workItems, siteLead: null };
      const prisma: any = {
        visitHistory: {
          findUnique: jest.fn(async () => row),
          update: jest.fn(async () => ({ ...row, user: {}, assignees: [], siteLead: null })),
        },
        visitStaff: { findMany: jest.fn(async () => []) },
      };
      const svc = new CrmAppointmentsService(prisma, {} as never, {} as never, { assertDayCapacity: jest.fn() } as never, { listForUser: jest.fn() } as never, { notify: jest.fn() } as never);
      await svc.update(1, dto as never).catch(() => undefined);
      return prisma.visitHistory.update.mock.calls[0]?.[0].data as Record<string, unknown>;
    };

    it('есть перечень с ценами — форма не меняет ни цену, ни название услуги', async () => {
      const data = await run([{ priceRub: 100 }], { serviceType: 'Что-то другое', priceRub: 1, masterComment: 'ок' });
      expect(data).not.toHaveProperty('serviceType');
      expect(data).not.toHaveProperty('priceRub');
      expect(data.masterComment).toBe('ок');
    });

    it('в перечне есть позиция без цены — цену ещё можно задать вручную', async () => {
      const data = await run([{ priceRub: null }], { serviceType: 'Что-то другое', priceRub: 900 });
      expect(data).not.toHaveProperty('serviceType');
      expect(data.priceRub).toBe(900);
    });

    it('без перечня работает как раньше', async () => {
      const data = await run([], { serviceType: 'Осмотр', priceRub: 900 });
      expect(data).toMatchObject({ serviceType: 'Осмотр', priceRub: 900 });
    });
  });
});
