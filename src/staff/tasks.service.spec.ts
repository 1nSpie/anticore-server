import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { taskDisplayStatus } from "./task-status";

const NOW = new Date("2026-10-10T12:00:00Z");
const past = new Date("2026-10-09T12:00:00Z");
const future = new Date("2026-10-11T12:00:00Z");

describe("taskDisplayStatus", () => {
  it("просроченная открытая задача — OVERDUE, будущий срок — как есть", () => {
    expect(taskDisplayStatus({ status: "NEW", dueAt: past, confirmedAt: null }, NOW)).toBe("OVERDUE");
    expect(taskDisplayStatus({ status: "IN_PROGRESS", dueAt: past, confirmedAt: null }, NOW)).toBe("OVERDUE");
    expect(taskDisplayStatus({ status: "IN_PROGRESS", dueAt: future, confirmedAt: null }, NOW)).toBe("IN_PROGRESS");
    expect(taskDisplayStatus({ status: "NEW", dueAt: null, confirmedAt: null }, NOW)).toBe("NEW");
  });

  it("выполненная после срока не считается просроченной; без подтверждения — DONE, с ним — CONFIRMED", () => {
    expect(taskDisplayStatus({ status: "DONE", dueAt: past, confirmedAt: null }, NOW)).toBe("DONE");
    expect(taskDisplayStatus({ status: "DONE", dueAt: past, confirmedAt: NOW }, NOW)).toBe("CONFIRMED");
  });

  it("отменённая всегда CANCELLED", () => {
    expect(taskDisplayStatus({ status: "CANCELLED", dueAt: past, confirmedAt: null }, NOW)).toBe("CANCELLED");
  });
});

function setup(task: any, staff: any = { role: "MASTER", blockedAt: null, fullName: "М" }) {
  const full = task && { photos: [], title: "t", description: null, priority: "NORMAL", masterComment: null, adminComment: null, doneAt: null, createdAt: NOW, staff: { id: task.staffId, fullName: "М" }, ...task };
  const prisma: any = {
    task: {
      findUnique: jest.fn(async () => task),
      findUniqueOrThrow: jest.fn(async () => full),
      create: jest.fn(async ({ data }) => ({ ...full, ...data, id: 1, photos: [], staff: { id: data.staffId, fullName: "М" } })),
      update: jest.fn(async ({ data }) => ({ ...full, ...data })),
      findMany: jest.fn(async () => []),
    },
    staff: { findUnique: jest.fn(async () => staff) },
  };
  const audit: any = { log: jest.fn(async () => undefined) };
  const notifications: any = { notify: jest.fn(async () => undefined) };
  const storage: any = { put: jest.fn(async () => undefined), remove: jest.fn(async () => undefined), publicUrl: jest.fn((k: string) => `https://files.example/admin/${k}`) };
  return { prisma, audit, notifications, storage, svc: new TasksService(prisma, audit, notifications, storage) };
}
const row = (over: any = {}) => ({ id: 5, staffId: 7, status: "NEW", dueAt: null, confirmedAt: null, ...over });

describe("TasksService — админ", () => {
  it("создаёт задачу только активному мастеру", async () => {
    for (const staff of [null, { role: "ADMIN", blockedAt: null, fullName: "А" }, { role: "MASTER", blockedAt: new Date(), fullName: "Б" }]) {
      const { svc } = setup(null, staff);
      await expect(svc.create({ staffId: 7, title: "Помыть пост" } as any, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it("мастер сразу получает уведомление о новой задаче", async () => {
    const { svc, notifications } = setup(null);
    await svc.create({ staffId: 7, title: "Помыть пост" } as any, {} as any);
    expect(notifications.notify).toHaveBeenCalledWith([7], expect.objectContaining({ type: "TASK_NEW", body: "Помыть пост" }));
  });

  it("подтверждение и возврат в работу уведомляют мастера; возврат несёт комментарий", async () => {
    const a = setup(row({ status: "DONE" }));
    await a.svc.confirm(5, {} as any);
    expect(a.notifications.notify).toHaveBeenCalledWith([7], expect.objectContaining({ type: "TASK_CONFIRMED" }));
    const b = setup(row({ status: "DONE" }));
    await b.svc.returnToWork(5, "Не домыли порог", {} as any);
    expect(b.notifications.notify).toHaveBeenCalledWith([7], expect.objectContaining({ type: "TASK_RETURNED", body: expect.stringContaining("Не домыли порог") }));
  });

  it("ошибка (нельзя подтвердить невыполненную) — уведомления нет", async () => {
    const { svc, notifications } = setup(row({ status: "NEW" }));
    await expect(svc.confirm(5, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("создание пишется в журнал", async () => {
    const { svc, audit } = setup(null);
    await svc.create({ staffId: 7, title: "Помыть пост" } as any, {} as any);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "TASK_CREATED", staffId: 7 }));
  });

  it("подтвердить можно только выполненную мастером", async () => {
    for (const status of ["NEW", "IN_PROGRESS", "CANCELLED"]) {
      const { svc } = setup(row({ status }));
      await expect(svc.confirm(5, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    }
    const { svc, prisma, audit } = setup(row({ status: "DONE" }));
    await svc.confirm(5, {} as any);
    expect(prisma.task.update.mock.calls[0][0].data.confirmedAt).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "TASK_CONFIRMED" }));
  });

  it("возврат в работу: выполненная → «В работе» с комментарием; подтверждённую вернуть нельзя", async () => {
    const ok = setup(row({ status: "DONE" }));
    await ok.svc.returnToWork(5, "Не домыли порог", {} as any);
    expect(ok.prisma.task.update.mock.calls[0][0].data).toMatchObject({ status: "IN_PROGRESS", doneAt: null, adminComment: "Не домыли порог" });
    const locked = setup(row({ status: "DONE", confirmedAt: NOW }));
    await expect(locked.svc.returnToWork(5, undefined, {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("подтверждённую задачу нельзя отменить и изменить", async () => {
    const { svc } = setup(row({ status: "DONE", confirmedAt: NOW }));
    await expect(svc.cancel(5, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.update(5, { title: "x" } as any, {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("TasksService — мастер", () => {
  it("чужая задача для мастера «не найдена»", async () => {
    const { svc } = setup(row({ staffId: 99 }));
    await expect(svc.start(7, 5)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.complete(7, 5, undefined, "ivan", {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("«Выполнена» ставит DONE без подтверждения, пишет комментарий и журнал", async () => {
    const { svc, prisma, audit } = setup(row({ status: "IN_PROGRESS" }));
    await svc.complete(7, 5, "Готово, фото в чате", "ivan", {} as any);
    expect(prisma.task.update.mock.calls[0][0].data).toMatchObject({ status: "DONE", masterComment: "Готово, фото в чате" });
    expect(prisma.task.update.mock.calls[0][0].data.confirmedAt).toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "TASK_DONE", actor: "ivan" }));
  });

  it("закрытую, ждущую подтверждения или отменённую задачу мастер менять не может", async () => {
    for (const status of ["DONE", "CANCELLED"]) {
      const { svc } = setup(row({ status }));
      await expect(svc.complete(7, 5, undefined, "ivan", {} as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.start(7, 5)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it("список мастера: открытые выше ждущих и закрытых, высокий приоритет выше", async () => {
    const mk = (id: number, over: any) => ({ id, status: "NEW", priority: "NORMAL", dueAt: null, confirmedAt: null, photos: [], ...over });
    const { svc, prisma } = setup(null);
    prisma.task.findMany.mockResolvedValue([
      mk(1, { status: "DONE", confirmedAt: NOW }),
      mk(2, { status: "DONE" }),
      mk(3, { priority: "LOW" }),
      mk(4, { priority: "HIGH" }),
    ]);
    const ids = (await svc.listForMaster(7)).map((t) => t.id);
    expect(ids).toEqual([4, 3, 2, 1]);
  });
});

describe("TasksService — фото", () => {
  let png: Buffer;
  beforeAll(async () => {
    png = await require("sharp")({ create: { width: 64, height: 48, channels: 3, background: "#336699" } }).png().toBuffer();
  });
  const file = (buffer: Buffer) => ({ buffer, originalname: "p.png" }) as any;

  const withPhotos = (task: any, extra: Record<string, any> = {}) => {
    const base = setup(task);
    base.prisma.taskPhoto = {
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }) => ({ id: 1, ...data })),
      findFirst: jest.fn(async () => null),
      delete: jest.fn(async () => undefined),
      ...extra,
    };
    return base;
  };

  it("мастер: фото к своей задаче перекодируется в WebP и кладётся в хранилище под tasks/{id}/", async () => {
    const { svc, storage, prisma, audit } = withPhotos(row({ status: "IN_PROGRESS" }));
    await svc.addPhotoAsMaster(7, "ivan", 5, file(png), {} as any);
    const [key, body, type] = storage.put.mock.calls[0];
    expect(key).toMatch(/^tasks\/5\/[0-9a-f-]{36}\.webp$/);
    expect(type).toBe("image/webp");
    expect((await require("sharp")(body).metadata()).format).toBe("webp");
    expect(prisma.taskPhoto.create.mock.calls[0][0].data).toMatchObject({ taskId: 5, key, uploadedBy: "MASTER" });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "TASK_PHOTO_ADDED", actor: "ivan" }));
  });

  it("админ: добавляет с пометкой ADMIN, но не к отменённой задаче", async () => {
    const ok = withPhotos(row({ status: "DONE", confirmedAt: new Date() }));
    await ok.svc.addPhotoAsAdmin(5, file(png), {} as any);
    expect(ok.prisma.taskPhoto.create.mock.calls[0][0].data.uploadedBy).toBe("ADMIN");
    const cancelled = withPhotos(row({ status: "CANCELLED" }));
    await expect(cancelled.svc.addPhotoAsAdmin(5, file(png), {} as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(cancelled.storage.put).not.toHaveBeenCalled();
  });

  it("мастер: чужая задача — 404; отменённая и подтверждённая — 400; в хранилище ничего не уходит", async () => {
    const foreign = withPhotos(row({ staffId: 99 }));
    await expect(foreign.svc.addPhotoAsMaster(7, "ivan", 5, file(png), {} as any)).rejects.toBeInstanceOf(NotFoundException);
    for (const over of [{ status: "CANCELLED" }, { status: "DONE", confirmedAt: new Date() }]) {
      const t = withPhotos(row(over));
      await expect(t.svc.addPhotoAsMaster(7, "ivan", 5, file(png), {} as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(t.storage.put).not.toHaveBeenCalled();
    }
  });

  it("выполненная, но ещё не подтверждённая задача: мастер может дослать фото", async () => {
    const t = withPhotos(row({ status: "DONE" }));
    await expect(t.svc.addPhotoAsMaster(7, "ivan", 5, file(png), {} as any)).resolves.toBeDefined();
  });

  it("не больше 12 фото на задачу", async () => {
    const t = withPhotos(row(), { count: jest.fn(async () => 12) });
    await expect(t.svc.addPhotoAsMaster(7, "ivan", 5, file(png), {} as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(t.storage.put).not.toHaveBeenCalled();
  });

  it("не картинка и пустой файл отклоняются до загрузки в хранилище", async () => {
    const t = withPhotos(row());
    await expect(t.svc.addPhotoAsMaster(7, "ivan", 5, file(Buffer.from("MZ not an image")), {} as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(t.svc.addPhotoAsMaster(7, "ivan", 5, undefined, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(t.storage.put).not.toHaveBeenCalled();
  });

  it("сбой записи в БД после загрузки — объект удаляется из хранилища (нет сирот)", async () => {
    const t = withPhotos(row(), { create: jest.fn(async () => { throw new Error("db down"); }) });
    await expect(t.svc.addPhotoAsMaster(7, "ivan", 5, file(png), {} as any)).rejects.toThrow("db down");
    expect(t.storage.remove).toHaveBeenCalledWith(t.storage.put.mock.calls[0][0]);
  });

  it("в ответ уходят прямые ссылки на файлы, а ключи объектов — нет", async () => {
    const t = withPhotos(row());
    t.prisma.task.findUniqueOrThrow.mockResolvedValue({
      id: 5, staffId: 7, status: "NEW", dueAt: null, confirmedAt: null, staff: { id: 7, fullName: "М" },
      photos: [{ id: 1, key: "tasks/5/a.webp", uploadedBy: "ADMIN", createdAt: new Date() }],
    });
    const r: any = await t.svc.addPhotoAsMaster(7, "ivan", 5, file(png), {} as any);
    expect(r.photos[0]).toMatchObject({ id: 1, by: "ADMIN", url: "https://files.example/admin/tasks/5/a.webp" });
    expect(JSON.stringify(r)).not.toContain('"key"'); // сырой ключ объекта наружу не уходит — только готовая ссылка
    expect(r.photos[0].key).toBeUndefined();
  });

  it("мастер удаляет только свои фото; фото админа ему «не найдено»", async () => {
    const adminPhoto = { id: 3, taskId: 5, key: "tasks/5/a.webp", uploadedBy: "ADMIN" };
    const t = withPhotos(row(), { findFirst: jest.fn(async () => adminPhoto) });
    await expect(t.svc.deletePhotoAsMaster(7, "ivan", 5, 3, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(t.prisma.taskPhoto.delete).not.toHaveBeenCalled();
    expect(t.storage.remove).not.toHaveBeenCalled();
  });

  it("мастер удаляет своё фото: запись и объект; после подтверждения задачи — нельзя", async () => {
    const mine = { id: 4, taskId: 5, key: "tasks/5/m.webp", uploadedBy: "MASTER" };
    const t = withPhotos(row(), { findFirst: jest.fn(async () => mine) });
    await t.svc.deletePhotoAsMaster(7, "ivan", 5, 4, {} as any);
    expect(t.prisma.taskPhoto.delete).toHaveBeenCalledWith({ where: { id: 4 } });
    expect(t.storage.remove).toHaveBeenCalledWith("tasks/5/m.webp");
    const locked = withPhotos(row({ status: "DONE", confirmedAt: new Date() }), { findFirst: jest.fn(async () => mine) });
    await expect(locked.svc.deletePhotoAsMaster(7, "ivan", 5, 4, {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("админ удаляет любое фото задачи", async () => {
    const mine = { id: 4, taskId: 5, key: "tasks/5/m.webp", uploadedBy: "MASTER" };
    const t = withPhotos(row(), { findFirst: jest.fn(async () => mine) });
    await t.svc.deletePhotoAsAdmin(5, 4, {} as any);
    expect(t.storage.remove).toHaveBeenCalledWith("tasks/5/m.webp");
  });

  it("фото берётся только из этой задачи: поиск по паре (id фото, id задачи)", async () => {
    const t = withPhotos(row());
    await expect(t.svc.deletePhotoAsAdmin(5, 77, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(t.prisma.taskPhoto.findFirst).toHaveBeenCalledWith({ where: { id: 77, taskId: 5 } });
  });
});
