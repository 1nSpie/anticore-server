import { AdminNotificationsService, AdminNotificationType } from "./admin-notifications.service";

const row = { id: 7, type: "LEAD_NEW", title: "Новая заявка", body: null, link: "/admin/leads", readAt: null, createdAt: new Date() };

function make() {
  const prisma = {
    adminNotification: { create: jest.fn().mockResolvedValue(row) },
    pushSubscription: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    staff: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const events = { emitToAdmins: jest.fn() };
  const pushes = { enabled: false, publicKey: null, listAll: jest.fn().mockResolvedValue([]), send: jest.fn() };
  const service = new AdminNotificationsService(prisma as never, events as never, pushes as never);
  return { prisma, events, pushes, service };
}

describe("AdminNotificationsService", () => {
  it("сохраняет уведомление и рассылает его администраторам по сокету", async () => {
    const { prisma, events, service } = make();
    await service.notify({ type: AdminNotificationType.LEAD_NEW, title: "Новая заявка", link: "/admin/leads" });
    expect(prisma.adminNotification.create).toHaveBeenCalledTimes(1);
    expect(events.emitToAdmins).toHaveBeenCalledWith("notification", row);
  });

  it("без VAPID-ключей push отключён и подписки не читаются", async () => {
    const { pushes, service } = make();
    expect(service.publicKey).toBeNull();
    await service.notify({ type: AdminNotificationType.LEAD_NEW, title: "x" });
    expect(pushes.listAll).not.toHaveBeenCalled();
  });

  it("сбой БД не бросает исключение (приём заявки не ломается)", async () => {
    const { prisma, service } = make();
    prisma.adminNotification.create.mockRejectedValue(new Error("db down"));
    await expect(service.notify({ type: AdminNotificationType.LEAD_NEW, title: "x" })).resolves.toBeUndefined();
  });
});
