import { ClientVehiclesService } from './client-vehicles.service';

describe('ClientVehiclesService: year and plate', () => {
  let created: Record<string, unknown> | null;
  let service: ClientVehiclesService;

  beforeEach(() => {
    created = null;
    const prisma = {
      cabinetUser: { findUnique: jest.fn().mockResolvedValue({ id: 1 }), update: jest.fn() },
      car: { findUnique: jest.fn().mockResolvedValue({ id: 5 }) },
      clientVehicle: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => (created = { id: 1, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), car: null, ...data })),
      },
    };
    service = new ClientVehiclesService(prisma as never);
  });

  it('stores the year and a normalized plate and returns them in the view', async () => {
    const view = await service.create(1, { carId: 5, year: 2019, plate: ' а123 вс77 ' });
    expect(created).toMatchObject({ year: 2019, plate: 'А123ВС77' });
    expect(view).toMatchObject({ year: 2019, plate: 'А123ВС77' });
  });

  it('rejects an out-of-range year', async () => {
    await expect(service.create(1, { carId: 5, year: 1850 })).rejects.toThrow('Год выпуска');
  });

  it('CRM creation (requireComplete) demands model and year', async () => {
    await expect(service.create(1, { vin: undefined, customLabel: 'Lada Niva' }, { requireComplete: true })).rejects.toThrow(
      'Не заполнено: год выпуска',
    );
    await expect(service.create(1, { carId: 5 }, { requireComplete: true })).rejects.toThrow('год выпуска');
    await expect(service.create(1, { carId: 5, year: 2020 }, { requireComplete: true })).resolves.toBeDefined();
  });

  it('the cabinet path (no requireComplete) still accepts a car without a year', async () => {
    await expect(service.create(1, { carId: 5 })).resolves.toBeDefined();
  });
});
