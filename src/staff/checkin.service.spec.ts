import { ConflictException, ForbiddenException } from "@nestjs/common";
import { BRANCH_GEO } from "./branch-geo";
import { CheckinService } from "./checkin.service";

const principal: any = { id: 7, login: "ivan", fullName: "Иван", role: "MASTER", locations: ["KOLOMNA"] };

function setup(opts: { staff?: any; existing?: any }) {
  const prisma: any = {
    staff: { findUnique: jest.fn(async () => opts.staff ?? { geoConsentAt: new Date(), locations: ["KOLOMNA"] }) },
    checkin: {
      findUnique: jest.fn(async () => opts.existing ?? null),
      create: jest.fn(async ({ data }) => ({ id: 1, status: "PENDING", ...data })),
      update: jest.fn(async ({ data }) => ({ id: opts.existing?.id, ...data })),
    },
  };
  const audit: any = { log: jest.fn(async () => undefined) };
  const notifications: any = { notify: jest.fn(async () => undefined) };
  return { prisma, audit, notifications, svc: new CheckinService(prisma, audit, notifications) };
}
const at = (loc: keyof typeof BRANCH_GEO, dLat = 0) => ({ lat: BRANCH_GEO[loc].lat + dLat, lng: BRANCH_GEO[loc].lng });

describe("CheckinService.checkin", () => {
  it("без согласия на геолокацию → 403", async () => {
    const { svc } = setup({ staff: { geoConsentAt: null, locations: [] } });
    await expect(svc.checkin(principal, at("KOLOMNA"), {} as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("филиал подставляется по ближайшему из филиалов мастера; рядом — без пометки", async () => {
    const { svc, prisma } = setup({});
    await svc.checkin(principal, at("KOLOMNA"), {} as any);
    expect(prisma.checkin.create.mock.calls[0][0].data).toMatchObject({ staffId: 7, location: "KOLOMNA", outOfRadius: false, distanceM: 0 });
  });

  it("далеко от филиала — чекин разрешён с пометкой «вне радиуса»", async () => {
    const { svc, prisma } = setup({});
    await svc.checkin(principal, { ...at("KOLOMNA", 0.01), location: "KOLOMNA" }, {} as any);
    const data = prisma.checkin.create.mock.calls[0][0].data;
    expect(data.outOfRadius).toBe(true);
    expect(data.distanceM).toBeGreaterThan(1000);
  });

  it("второй чекин за день (ожидает или подтверждён) → 409", async () => {
    for (const status of ["PENDING", "CONFIRMED"]) {
      const { svc } = setup({ existing: { id: 3, status } });
      await expect(svc.checkin(principal, at("KOLOMNA"), {} as any)).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it("после отклонения чекин можно повторить — запись возвращается в «ожидает»", async () => {
    const { svc, prisma } = setup({ existing: { id: 3, status: "REJECTED" } });
    await svc.checkin(principal, at("KOLOMNA"), {} as any);
    expect(prisma.checkin.create).not.toHaveBeenCalled();
    expect(prisma.checkin.update.mock.calls[0][0].data).toMatchObject({ status: "PENDING", decidedAt: null });
  });
});

describe("CheckinService.decide — уведомление мастеру", () => {
  const setupDecide = () => {
    const base = setup({});
    base.prisma.checkin.findUnique = jest.fn(async () => ({ id: 4, staffId: 7 }));
    base.prisma.checkin.update = jest.fn(async () => ({ id: 4, status: "CONFIRMED" }));
    return base;
  };

  it("подтверждение → мастер получает CHECKIN_CONFIRMED", async () => {
    const { svc, notifications } = setupDecide();
    await svc.decide(4, "CONFIRMED", {} as any);
    expect(notifications.notify).toHaveBeenCalledWith([7], expect.objectContaining({ type: "CHECKIN_CONFIRMED" }));
  });

  it("отклонение → CHECKIN_REJECTED с подсказкой, что делать", async () => {
    const { svc, notifications } = setupDecide();
    await svc.decide(4, "REJECTED", {} as any);
    expect(notifications.notify).toHaveBeenCalledWith([7], expect.objectContaining({ type: "CHECKIN_REJECTED", body: expect.stringContaining("Отметьтесь") }));
  });
});
