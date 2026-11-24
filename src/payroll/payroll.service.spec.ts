import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PayrollService } from "./payroll.service";

function setup(over: Record<string, any> = {}) {
  const prisma: any = {
    payrollSettings: { findUnique: jest.fn(async () => ({ masterBaseRub: 3000, receiverBaseRub: 500 })), upsert: jest.fn() },
    visitHistory: { findUnique: jest.fn(async () => ({ id: 1, completedAt: null, receiverId: null })), update: jest.fn((a) => ({ op: "visit", a })) },
    staff: { findMany: jest.fn(async () => [{ id: 7, fullName: "Мастер" }]), findUnique: jest.fn() },
    payrollEntry: {
      createMany: jest.fn(),
      deleteMany: jest.fn((a) => ({ op: "del", a })),
      create: jest.fn((a) => ({ op: "create", a })),
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
    },
    payrollBonus: { upsert: jest.fn(), deleteMany: jest.fn() },
    payrollBonusType: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (ops) => ops),
    ...over,
  };
  const audit: any = { log: jest.fn(async () => undefined) };
  const svc = new PayrollService(prisma, audit);
  jest.spyOn(svc, "forVisit").mockResolvedValue({} as never);
  return { prisma, audit, svc };
}

describe("PayrollService.syncMasters", () => {
  it("новому мастеру сразу считается базовая ставка из настроек", async () => {
    const { svc, prisma } = setup();
    await svc.syncMasters(1, [7], []);
    expect(prisma.payrollEntry.createMany.mock.calls[0][0].data).toEqual([
      { visitId: 1, staffId: 7, staffName: "Мастер", role: "MASTER", baseRub: 3000, accruedAt: null },
    ]);
  });

  it("если машина уже закрыта, начисление сразу «начислено»", async () => {
    const closed = new Date("2026-11-20T10:00:00Z");
    const { svc, prisma } = setup();
    prisma.visitHistory.findUnique.mockResolvedValue({ completedAt: closed });
    await svc.syncMasters(1, [7], []);
    expect(prisma.payrollEntry.createMany.mock.calls[0][0].data[0].accruedAt).toBe(closed);
  });

  it("снятому мастеру начисление удаляется", async () => {
    const { svc, prisma } = setup();
    await svc.syncMasters(1, [], [4]);
    expect(prisma.payrollEntry.deleteMany).toHaveBeenCalledWith({ where: { visitId: 1, role: "MASTER", staffId: { in: [4] } } });
    expect(prisma.payrollEntry.createMany).not.toHaveBeenCalled();
  });
});

describe("PayrollService.setReceiver", () => {
  const admin = { role: "ADMIN", blockedAt: null, fullName: "Админ" };

  it("приёмщику сразу считается ставка приёмщика", async () => {
    const { svc, prisma } = setup();
    prisma.staff.findUnique.mockResolvedValue(admin);
    await svc.setReceiver(1, 5, {} as any);
    expect(prisma.payrollEntry.deleteMany).toHaveBeenCalledWith({ where: { visitId: 1, role: "RECEIVER" } });
    expect(prisma.payrollEntry.create).toHaveBeenCalledWith({
      data: { visitId: 1, staffId: 5, staffName: "Админ", role: "RECEIVER", baseRub: 500, accruedAt: null },
    });
  });

  it("мастера приёмщиком назначить нельзя", async () => {
    const { svc, prisma } = setup();
    prisma.staff.findUnique.mockResolvedValue({ ...admin, role: "MASTER" });
    await expect(svc.setReceiver(1, 5, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("заблокированного администратора назначить нельзя", async () => {
    const { svc, prisma } = setup();
    prisma.staff.findUnique.mockResolvedValue({ ...admin, blockedAt: new Date() });
    await expect(svc.setReceiver(1, 5, {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("снять приёмщика: начисление удаляется, новое не создаётся", async () => {
    const { svc, prisma } = setup();
    prisma.visitHistory.findUnique.mockResolvedValue({ id: 1, completedAt: null, receiverId: 5 });
    await svc.setReceiver(1, null, {} as any);
    expect(prisma.payrollEntry.create).not.toHaveBeenCalled();
    expect(prisma.payrollEntry.deleteMany).toHaveBeenCalled();
  });

  it("тот же приёмщик — ничего не меняется", async () => {
    const { svc, prisma } = setup();
    prisma.visitHistory.findUnique.mockResolvedValue({ id: 1, completedAt: null, receiverId: 5 });
    await svc.setReceiver(1, 5, {} as any);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("запись не найдена → 404", async () => {
    const { svc, prisma } = setup();
    prisma.visitHistory.findUnique.mockResolvedValue(null);
    await expect(svc.setReceiver(9, 5, {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("PayrollService.setBonus", () => {
  const entry = (over = {}) => ({ id: 1, visitId: 3, role: "MASTER", accruedAt: new Date(), ...over });
  const type = (over = {}) => ({ id: 2, title: "Чистота", amountRub: 300, role: "MASTER", active: true, ...over });

  it("до закрытия машины доп. выплату поставить нельзя", async () => {
    const { svc, prisma } = setup();
    prisma.payrollEntry.findUnique.mockResolvedValue(entry({ accruedAt: null }));
    await expect(svc.setBonus(1, 2, true, {} as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it("выплата для приёмщика не ставится мастеру", async () => {
    const { svc, prisma } = setup();
    prisma.payrollEntry.findUnique.mockResolvedValue(entry());
    prisma.payrollBonusType.findUnique.mockResolvedValue(type({ role: "RECEIVER" }));
    await expect(svc.setBonus(1, 2, true, {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("сумма и название копируются из справочника на момент отметки", async () => {
    const { svc, prisma } = setup();
    prisma.payrollEntry.findUnique.mockResolvedValue(entry());
    prisma.payrollBonusType.findUnique.mockResolvedValue(type());
    await svc.setBonus(1, 2, true, {} as any);
    expect(prisma.payrollBonus.upsert.mock.calls[0][0].create).toEqual({ entryId: 1, typeId: 2, title: "Чистота", amountRub: 300, grantedBy: "admin" });
  });

  it("отключённый тип поставить нельзя, но снять можно", async () => {
    const { svc, prisma } = setup();
    prisma.payrollEntry.findUnique.mockResolvedValue(entry());
    prisma.payrollBonusType.findUnique.mockResolvedValue(type({ active: false }));
    await expect(svc.setBonus(1, 2, true, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    await svc.setBonus(1, 2, false, {} as any);
    expect(prisma.payrollBonus.deleteMany).toHaveBeenCalledWith({ where: { entryId: 1, typeId: 2 } });
  });
});

describe("PayrollService.report", () => {
  it("суммирует по сотрудникам: ставка + доп. выплаты", async () => {
    const { svc, prisma } = setup();
    const row = (id: number, staffId: number, name: string, base: number, bonuses: number[]) => ({
      id, visitId: id, staffId, staffName: name, role: "MASTER", baseRub: base, accruedAt: new Date("2026-11-10T09:00:00Z"),
      bonuses: bonuses.map((a) => ({ title: "b", amountRub: a })),
      visit: { id, visitDate: new Date("2026-11-10T00:00:00Z"), serviceType: "x", location: "ZHUKOVSKY", docNumber: null },
    });
    prisma.payrollEntry.findMany.mockResolvedValue([row(1, 7, "Иван", 3000, [300]), row(2, 7, "Иван", 3000, []), row(3, 8, "Пётр", 3000, [])]);
    const r = await svc.report({ from: "2026-11-01", to: "2026-11-30" } as never);
    expect(r.staff).toEqual([
      { staffId: 7, staffName: "Иван", baseRub: 6000, bonusRub: 300, totalRub: 6300, orders: 2 },
      { staffId: 8, staffName: "Пётр", baseRub: 3000, bonusRub: 0, totalRub: 3000, orders: 1 },
    ]);
    expect(r.totalRub).toBe(9300);
  });

  it("период больше года отклоняется", async () => {
    const { svc } = setup();
    await expect(svc.report({ from: "2024-01-01", to: "2026-01-01" } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
