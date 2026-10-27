import { CrmAppointmentsService } from "./crm-appointments.service";

const initial = {
  id: 1, userId: 1, vehicleId: null, visitDate: new Date("2026-10-10T07:00:00Z"),
  startsAt: new Date("2026-10-10T07:00:00Z"), endsAt: new Date("2026-10-10T09:00:00Z"),
  serviceType: "Антикор днища", serviceTypeId: null, priceRub: 15000, managerName: null,
  masterComment: null as string | null, location: "KOLOMNA", user: { id: 1, phone: "test" }, siteLead: null,
};

function setup(assignees: { staffId: number }[]) {
  let row: any = { ...initial };
  const prisma: any = {
    cabinetUser: { findUnique: jest.fn(async () => ({ id: 1 })) },
    visitHistory: {
      findUnique: jest.fn(async () => row),
      update: jest.fn(async ({ data }) => (row = { ...row, ...data })),
      delete: jest.fn(async () => undefined),
    },
    siteLead: { updateMany: jest.fn(async () => ({ count: 0 })) },
    visitStaff: { findMany: jest.fn(async () => assignees) },
    $transaction: jest.fn(async (ops) => ops),
  };
  const notifications: any = { notify: jest.fn(async () => undefined) };
  const service = new CrmAppointmentsService(
    prisma, { sendAppointmentSms: jest.fn() } as never, {} as never,
    { assertDayCapacity: jest.fn() } as never, { listForUser: jest.fn(async () => []) } as never, notifications,
  );
  return { service, prisma, notifications };
}

describe("уведомления назначенным мастерам при правке записи", () => {
  it("перенос времени → «Изменение в расписании» всем назначенным мастерам", async () => {
    const { service, notifications } = setup([{ staffId: 3 }, { staffId: 4 }]);
    await service.update(1, { startsAt: "2026-10-11T07:00:00Z", endsAt: "2026-10-11T09:00:00Z" });
    expect(notifications.notify).toHaveBeenCalledWith([3, 4], expect.objectContaining({ type: "SCHEDULE_CHANGED", title: "Изменение в расписании" }));
  });

  it("смена филиала или услуги тоже существенна", async () => {
    const a = setup([{ staffId: 3 }]);
    await a.service.update(1, { location: "ZHUKOVSKY" });
    expect(a.notifications.notify).toHaveBeenCalledTimes(1);
    const b = setup([{ staffId: 3 }]);
    await b.service.update(1, { serviceType: "Комплекс" });
    expect(b.notifications.notify).toHaveBeenCalledTimes(1);
  });

  it("цена, комментарий и менеджер мастера не беспокоят", async () => {
    const { service, notifications } = setup([{ staffId: 3 }]);
    await service.update(1, { priceRub: 20000, masterComment: "Новый комментарий", managerName: "Анна" });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("запись без назначенных мастеров — уведомлять некого, но ошибки нет", async () => {
    const { service, notifications } = setup([]);
    await service.update(1, { serviceType: "Комплекс" });
    expect(notifications.notify).toHaveBeenCalledWith([], expect.anything());
  });

  it("удаление записи → «Запись отменена» назначенным мастерам (список собран до каскадного удаления)", async () => {
    const { service, prisma, notifications } = setup([{ staffId: 3 }]);
    await service.remove(1);
    const order = [prisma.visitStaff.findMany.mock.invocationCallOrder[0], prisma.$transaction.mock.invocationCallOrder[0]];
    expect(order[0]).toBeLessThan(order[1]);
    expect(notifications.notify).toHaveBeenCalledWith([3], expect.objectContaining({ type: "SCHEDULE_CHANGED", title: "Запись отменена" }));
  });
});
