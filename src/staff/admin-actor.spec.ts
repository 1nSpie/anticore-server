import { adminActor } from "./staff-audit.service";
import { RegulationService } from "./regulation.service";
import { StaffAdminService } from "./staff-admin.service";
import { TasksService } from "./tasks.service";

describe("adminActor", () => {
  it("сотрудник-админ — его логин; env-админ, пустой запрос и мусор — «admin»", () => {
    expect(adminActor({ admin: { id: "staff:8", login: "anna" } })).toBe("anna");
    expect(adminActor({ admin: { id: "admin" } })).toBe("admin");
    expect(adminActor({})).toBe("admin");
    expect(adminActor(undefined)).toBe("admin");
    expect(adminActor({ admin: { login: "" } })).toBe("admin");
    expect(adminActor({ admin: { login: 42 } })).toBe("admin");
  });
});

describe("в журнал действий пишется, какой именно админ совершил действие", () => {
  const annaReq = { admin: { id: "staff:8", role: "admin", staffId: 8, login: "anna" } } as any;
  const envReq = { admin: { id: "admin", role: "admin" } } as any;
  const actorsOf = (audit: any) => audit.log.mock.calls.map((c: any[]) => c[0].actor);

  it("создание сотрудника и сброс пароля", async () => {
    const created = { id: 3, login: "ivan", role: "MASTER" };
    const prisma: any = { staff: { findUnique: jest.fn(async () => (prisma.exists ? { id: 3 } : null)), create: jest.fn(async () => created), update: jest.fn(async () => created) } };
    const audit: any = { log: jest.fn(async () => undefined) };
    const svc = new StaffAdminService(prisma, audit);
    await svc.create({ login: "Ivan", password: "secret-pass-1", fullName: "Иван", locations: [] } as any, annaReq);
    prisma.exists = true;
    await svc.resetPassword(3, {}, annaReq);
    await svc.setBlocked(3, true, envReq);
    expect(actorsOf(audit)).toEqual(["anna", "anna", "admin"]);
  });

  it("публикация регламента", async () => {
    const prisma: any = { regulationState: { upsert: jest.fn(async () => ({ id: 1 })), update: jest.fn(async () => ({ version: 2 })) } };
    const audit: any = { log: jest.fn(async () => undefined) };
    const notifications: any = { notifyAllMasters: jest.fn(async () => undefined) };
    await new RegulationService(prisma, audit, notifications).publish("note", annaReq);
    expect(actorsOf(audit)).toEqual(["anna"]);
  });

  it("создание и подтверждение задачи", async () => {
    const task = { id: 5, staffId: 7, title: "t", status: "DONE", dueAt: null, confirmedAt: null, description: null, priority: "NORMAL", masterComment: null, adminComment: null, doneAt: null, createdAt: new Date(), staff: { id: 7, fullName: "М" }, photos: [] };
    const prisma: any = {
      staff: { findUnique: jest.fn(async () => ({ role: "MASTER", blockedAt: null, fullName: "М" })) },
      task: { create: jest.fn(async () => task), findUnique: jest.fn(async () => task), update: jest.fn(async () => task) },
    };
    const audit: any = { log: jest.fn(async () => undefined) };
    const svc = new TasksService(prisma, audit, { notify: jest.fn() } as any, { publicUrl: jest.fn() } as any);
    await svc.create({ staffId: 7, title: "Помыть" } as any, annaReq);
    await svc.confirm(5, annaReq);
    expect(actorsOf(audit)).toEqual(["anna", "anna"]);
  });
});
