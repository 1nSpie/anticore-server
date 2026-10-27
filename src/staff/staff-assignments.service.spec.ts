import { BadRequestException, NotFoundException } from "@nestjs/common";
import { StaffAssignmentsService } from "./staff-assignments.service";

function setup(opts: { visit: any; staff?: any[]; after?: any[] }) {
  const prisma: any = {
    visitHistory: { findUnique: jest.fn(async () => opts.visit), findMany: jest.fn(async () => []) },
    staff: { findMany: jest.fn(async () => opts.staff ?? []) },
    visitStaff: {
      deleteMany: jest.fn((a) => ({ op: "delete", a })),
      createMany: jest.fn((a) => ({ op: "create", a })),
      findMany: jest.fn(async () => opts.after ?? []),
    },
    $transaction: jest.fn(async (ops) => ops),
  };
  const audit: any = { log: jest.fn(async () => undefined) };
  const notifications: any = { notify: jest.fn(async () => undefined) };
  return { prisma, audit, notifications, svc: new StaffAssignmentsService(prisma, audit, notifications) };
}
const master = (id: number, over = {}) => ({ id, role: "MASTER", blockedAt: null, fullName: `М${id}`, ...over });

describe("StaffAssignmentsService.setAssignees", () => {
  it("несуществующая запись → 404", async () => {
    const { svc } = setup({ visit: null });
    await expect(svc.setAssignees(1, [1], {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("добавляет новых и снимает отсутствующих в списке, пишет аудит", async () => {
    const { svc, prisma, audit } = setup({
      visit: { id: 1, assignees: [{ staffId: 1 }, { staffId: 2 }] },
      staff: [master(3)],
    });
    await svc.setAssignees(1, [2, 3], {} as any);
    expect(prisma.visitStaff.deleteMany).toHaveBeenCalledWith({ where: { visitId: 1, staffId: { in: [1] } } });
    expect(prisma.visitStaff.createMany.mock.calls[0][0].data).toEqual([{ visitId: 1, staffId: 3 }]);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "ASSIGNMENT_CHANGED", meta: { visitId: 1, added: [3], removed: [1] } }));
  });

  it("новым — «назначили», снятым — «сняли»; остающимся ничего не приходит", async () => {
    const { svc, notifications } = setup({
      visit: { id: 1, serviceType: "Антикор", startsAt: new Date("2026-10-10T07:00:00Z"), assignees: [{ staffId: 1 }, { staffId: 2 }] },
      staff: [master(3)],
    });
    await svc.setAssignees(1, [2, 3], {} as any);
    expect(notifications.notify).toHaveBeenCalledWith([3], expect.objectContaining({ type: "ASSIGNED", body: expect.stringContaining("Антикор") }));
    expect(notifications.notify).toHaveBeenCalledWith([1], expect.objectContaining({ type: "UNASSIGNED" }));
    expect(notifications.notify).toHaveBeenCalledTimes(2);
  });

  it("несколько мастеров на одну запись — допустимо", async () => {
    const { svc, prisma } = setup({ visit: { id: 1, assignees: [] }, staff: [master(1), master(2)] });
    await svc.setAssignees(1, [1, 2], {} as any);
    expect(prisma.visitStaff.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it("нельзя назначить заблокированного, админа или несуществующего", async () => {
    for (const staff of [[master(3, { blockedAt: new Date() })], [master(3, { role: "ADMIN" })], []]) {
      const { svc } = setup({ visit: { id: 1, assignees: [] }, staff });
      await expect(svc.setAssignees(1, [3], {} as any)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it("без изменений аудит не пишется", async () => {
    const { svc, audit, notifications } = setup({ visit: { id: 1, assignees: [{ staffId: 1 }] } });
    await svc.setAssignees(1, [1], {} as any);
    expect(audit.log).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe("StaffAssignmentsService.scheduleFor", () => {
  it("запрашивает только записи этого мастера и не выбирает клиента", async () => {
    const { svc, prisma } = setup({ visit: null });
    await svc.scheduleFor(9);
    const arg = prisma.visitHistory.findMany.mock.calls[0][0];
    expect(arg.where.assignees).toEqual({ some: { staffId: 9 } });
    expect(arg.select.user).toBeUndefined();
    expect(JSON.stringify(arg.select)).not.toMatch(/phone|firstName|lastName/);
  });

  it("отклоняет период, где конец раньше начала", async () => {
    const { svc } = setup({ visit: null });
    await expect(svc.scheduleFor(9, "2026-10-12T00:00:00Z", "2026-10-10T00:00:00Z")).rejects.toBeInstanceOf(BadRequestException);
  });
});
