import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { StaffAdminService, isEnvAdmin } from "./staff-admin.service";

const envReq = { admin: { id: "admin", role: "admin" } } as any;
const staffAdminReq = { admin: { id: "staff:3", role: "admin", staffId: 3, login: "boss" } } as any;

function setup(found: any = { id: 9, login: "m1", fullName: "Мастер", role: "MASTER" }) {
  const prisma: any = { staff: { findUnique: jest.fn(async () => found), delete: jest.fn() } };
  const audit: any = { log: jest.fn(async () => undefined) };
  return { prisma, audit, svc: new StaffAdminService(prisma, audit) };
}

describe("удаление сотрудника", () => {
  it("админ из env удаляет мастера, действие пишется в журнал", async () => {
    const { svc, prisma, audit } = setup();
    await svc.remove(9, envReq);
    expect(prisma.staff.delete).toHaveBeenCalledWith({ where: { id: 9 } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "STAFF_DELETED", meta: expect.objectContaining({ login: "m1" }) }));
  });

  it("админ из env может удалить и другого админа", async () => {
    const { svc, prisma } = setup({ id: 3, login: "boss", fullName: "Босс", role: "ADMIN" });
    await svc.remove(3, envReq);
    expect(prisma.staff.delete).toHaveBeenCalled();
  });

  it("сотрудник с ролью ADMIN удалять не может — 403, ничего не удалено", async () => {
    const { svc, prisma } = setup();
    await expect(svc.remove(9, staffAdminReq)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    expect(prisma.staff.delete).not.toHaveBeenCalled();
  });

  it("запрос без данных об админе — 403", async () => {
    const { svc } = setup();
    await expect(svc.remove(9, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("несуществующий сотрудник → 404", async () => {
    const { svc } = setup(null);
    await expect(svc.remove(9, envReq)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("isEnvAdmin распознаёт только env-админа", () => {
    expect(isEnvAdmin(envReq)).toBe(true);
    expect(isEnvAdmin(staffAdminReq)).toBe(false);
    expect(isEnvAdmin(undefined)).toBe(false);
  });
});
