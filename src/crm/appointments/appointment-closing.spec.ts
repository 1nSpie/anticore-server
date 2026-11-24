import { BadRequestException } from "@nestjs/common";
import { CrmAppointmentsService } from "./crm-appointments.service";

function setup(photos: string[], signed: string[], diskLink = "https://disk.yandex.ru/d/x") {
  const prisma: any = {
    visitHistory: {
      findUnique: jest.fn(async () => ({ id: 1, completedAt: null, diskLink, siteLead: null })),
      findUniqueOrThrow: jest.fn(async () => ({ id: 1 })),
      update: jest.fn((a) => ({ op: "visit", a })),
    },
    visitPhoto: { findMany: jest.fn(async () => photos.map((stage) => ({ stage }))) },
    document: {
      findMany: jest.fn(async () => ["CONTRACT", "ACCEPTANCE", "WORKS"].map((kind) => ({ kind, versions: [{ status: signed.includes(kind) ? "SIGNED" : "READY" }] }))),
    },
    payrollEntry: { updateMany: jest.fn((a) => ({ op: "payroll", a })) },
    $transaction: jest.fn(async (ops) => ops),
  };
  const svc: any = new CrmAppointmentsService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never);
  svc.toEvent = jest.fn(() => ({}));
  return { svc, prisma };
}

describe("закрытие машины и начисление зарплаты", () => {
  it("без фотоотчёта и подписей запись не закрывается, зарплата не начисляется", async () => {
    const { svc, prisma } = setup([], ["CONTRACT"]);
    const err = await svc.complete(1, {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({ code: "CLOSING_REQUIREMENTS" });
    expect(((err as BadRequestException).getResponse() as any).missing).toEqual(
      expect.arrayContaining(["Фото «до» работ", "Фото «после» работ", "Акт выполненных работ подписан"]),
    );
    expect(prisma.visitHistory.update).not.toHaveBeenCalled();
    expect(prisma.payrollEntry.updateMany).not.toHaveBeenCalled();
  });

  it("когда всё выполнено, запись закрывается и ставки становятся начисленными", async () => {
    const { svc, prisma } = setup(["WORK_BEFORE", "WORK_AFTER"], ["CONTRACT", "ACCEPTANCE", "WORKS"]);
    await svc.complete(1, {});
    expect(prisma.visitHistory.update).toHaveBeenCalled();
    expect(prisma.payrollEntry.updateMany).toHaveBeenCalledWith({ where: { visitId: 1, accruedAt: null }, data: { accruedAt: expect.any(Date) } });
  });
});
