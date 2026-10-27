import { NotificationsService } from "./notifications.service";

function setup() {
  let seq = 0;
  const prisma: any = {
    notification: {
      create: jest.fn(async ({ data }) => ({ id: ++seq, readAt: null, createdAt: new Date(), ...data })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 3),
      updateMany: jest.fn(async () => ({ count: 2 })),
    },
    staff: { findMany: jest.fn(async () => [{ id: 1 }, { id: 2 }]) },
  };
  const events: any = { emitToStaff: jest.fn() };
  return { prisma, events, svc: new NotificationsService(prisma, events) };
}
const input = { type: "TASK_NEW", title: "Новая задача", body: "Помыть пост", link: "/staff" } as const;

describe("NotificationsService.notify", () => {
  it("сохраняет уведомление и сразу шлёт его в комнату мастера (pop-up)", async () => {
    const { svc, prisma, events } = setup();
    await svc.notify([7], input);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ staffId: 7, type: "TASK_NEW", title: "Новая задача" });
    expect(events.emitToStaff).toHaveBeenCalledWith(7, "notification", expect.objectContaining({ id: 1, title: "Новая задача" }));
  });

  it("несколько получателей — каждому своё; дубли id и мусор отбрасываются", async () => {
    const { svc, prisma, events } = setup();
    await svc.notify([1, 2, 2, 1, NaN as any], input);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(events.emitToStaff.mock.calls.map((c: any[]) => c[0])).toEqual([1, 2]);
  });

  it("пустой список получателей — ничего не делает", async () => {
    const { svc, prisma } = setup();
    await svc.notify([], input);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("сбой БД не пробрасывается — бизнес-операция не должна падать из-за уведомления", async () => {
    const { svc, prisma } = setup();
    prisma.notification.create.mockRejectedValue(new Error("db down"));
    await expect(svc.notify([7], input)).resolves.toBeUndefined();
  });

  it("сбой WebSocket не мешает: уведомление уже в ленте, остальным мастерам уходит", async () => {
    const { svc, prisma, events } = setup();
    events.emitToStaff.mockImplementationOnce(() => { throw new Error("socket closed"); });
    await expect(svc.notify([1, 2], input)).resolves.toBeUndefined();
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(events.emitToStaff).toHaveBeenCalledTimes(2);
  });
});

describe("NotificationsService — рассылка и лента", () => {
  it("«всем мастерам» берёт только активных мастеров", async () => {
    const { svc, prisma } = setup();
    await svc.notifyAllMasters({ type: "REGULATION", title: "Регламент изменён" });
    expect(prisma.staff.findMany.mock.calls[0][0].where).toEqual({ role: "MASTER", blockedAt: null });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it("лента ограничена владельцем и не больше 100 записей", async () => {
    const { svc, prisma } = setup();
    const r = await svc.list(7, 5000);
    expect(prisma.notification.findMany.mock.calls[0][0]).toMatchObject({ where: { staffId: 7 }, take: 100 });
    expect(r.unread).toBe(3);
  });

  it("прочитать можно только своё: staffId входит в условие обновления", async () => {
    const { svc, prisma } = setup();
    await svc.markRead(7, 42);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 42, staffId: 7, readAt: null }, data: { readAt: expect.any(Date) } });
    await svc.markAllRead(7);
    expect(prisma.notification.updateMany.mock.calls[1][0].where).toEqual({ staffId: 7, readAt: null });
  });
});
