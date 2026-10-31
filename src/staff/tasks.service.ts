import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Request } from "express";
import { Prisma, StaffRole, TaskStatus } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizePhoto } from "../storage/normalize-image";
import { ObjectStorageService } from "../storage/object-storage.service";
import { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from "./dto/task.dto";
import { NotificationType, MASTER_HOME } from "./notification-types";
import { NotificationsService } from "./notifications.service";
import { StaffAuditAction, StaffAuditService, adminActor } from "./staff-audit.service";
import { isOpenForMaster, taskDisplayStatus } from "./task-status";

const taskSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  dueAt: true,
  masterComment: true,
  adminComment: true,
  doneAt: true,
  confirmedAt: true,
  createdAt: true,
  staff: { select: { id: true, fullName: true } },
  photos: { select: { id: true, key: true, uploadedBy: true, createdAt: true }, orderBy: { id: "asc" } },
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

/** Не больше стольких фото на задачу (защита хранилища от случайных и злонамеренных загрузок). */
export const MAX_TASK_PHOTOS = 12;

const PRIORITY_ORDER = { HIGH: 0, NORMAL: 1, LOW: 2 } as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
    private readonly notifications: NotificationsService,
    private readonly storage: ObjectStorageService,
  ) {}

  // ---------- админ ----------

  async list(q: TaskListQueryDto) {
    const rows = await this.prisma.task.findMany({
      where: { staffId: q.staffId },
      orderBy: { createdAt: "desc" },
      take: q.limit ?? 200,
      select: taskSelect,
    });
    const now = new Date();
    const items = await Promise.all(rows.map((r) => this.present(r, now)));
    return q.status ? items.filter((t) => t.displayStatus === q.status) : items;
  }

  async create(dto: CreateTaskDto, req: Request) {
    await this.requireActiveMaster(dto.staffId);
    const task = await this.prisma.task.create({
      data: {
        staffId: dto.staffId,
        title: dto.title,
        description: dto.description || null,
        priority: dto.priority,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
      select: taskSelect,
    });
    await this.audit.log({
      action: StaffAuditAction.TASK_CREATED,
      actor: adminActor(req),
      staffId: dto.staffId,
      req,
      meta: { taskId: task.id, title: task.title },
    });
    await this.notifications.notify([dto.staffId], {
      type: NotificationType.TASK_NEW,
      title: "Новая задача",
      body: task.title,
      link: MASTER_HOME,
    });
    return this.present(task);
  }

  async update(id: number, dto: UpdateTaskDto, req: Request) {
    const current = await this.requireTask(id);
    if (current.status === TaskStatus.CANCELLED || current.confirmedAt) {
      throw new BadRequestException("Закрытую задачу нельзя изменить");
    }
    if (dto.staffId && dto.staffId !== current.staffId) await this.requireActiveMaster(dto.staffId);
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        staffId: dto.staffId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueAt: dto.dueAt === undefined ? undefined : dto.dueAt === null ? null : new Date(dto.dueAt),
      },
      select: taskSelect,
    });
    await this.audit.log({ action: StaffAuditAction.TASK_UPDATED, actor: adminActor(req), staffId: task.staff.id, req, meta: { taskId: id } });
    return this.present(task);
  }

  /** Подтвердить выполнение: только то, что мастер уже отметил «Выполнена». */
  async confirm(id: number, req: Request) {
    const t = await this.requireTask(id);
    if (t.status !== TaskStatus.DONE) throw new BadRequestException("Мастер ещё не отметил задачу выполненной");
    if (t.confirmedAt) return this.present(await this.get(id));
    const task = await this.prisma.task.update({ where: { id }, data: { confirmedAt: new Date() }, select: taskSelect });
    await this.audit.log({ action: StaffAuditAction.TASK_CONFIRMED, actor: adminActor(req), staffId: t.staffId, req, meta: { taskId: id } });
    await this.notifications.notify([t.staffId], {
      type: NotificationType.TASK_CONFIRMED,
      title: "Выполнение подтверждено",
      body: task.title,
      link: MASTER_HOME,
    });
    return this.present(task);
  }

  /** Не принять выполнение: задача возвращается мастеру «В работе» с комментарием. */
  async returnToWork(id: number, comment: string | undefined, req: Request) {
    const t = await this.requireTask(id);
    if (t.status !== TaskStatus.DONE || t.confirmedAt) throw new BadRequestException("Вернуть можно только выполненную, но не подтверждённую задачу");
    const task = await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.IN_PROGRESS, doneAt: null, adminComment: comment || null },
      select: taskSelect,
    });
    await this.audit.log({ action: StaffAuditAction.TASK_RETURNED, actor: adminActor(req), staffId: t.staffId, req, meta: { taskId: id } });
    await this.notifications.notify([t.staffId], {
      type: NotificationType.TASK_RETURNED,
      title: "Задача возвращена в работу",
      body: comment ? `${task.title}: ${comment}` : task.title,
      link: MASTER_HOME,
    });
    return this.present(task);
  }

  async cancel(id: number, req: Request) {
    const t = await this.requireTask(id);
    if (t.status === TaskStatus.CANCELLED) return this.present(await this.get(id));
    if (t.confirmedAt) throw new BadRequestException("Подтверждённую задачу отменить нельзя");
    const task = await this.prisma.task.update({ where: { id }, data: { status: TaskStatus.CANCELLED }, select: taskSelect });
    await this.audit.log({ action: StaffAuditAction.TASK_CANCELLED, actor: adminActor(req), staffId: t.staffId, req, meta: { taskId: id } });
    return this.present(task);
  }

  // ---------- мастер ----------

  /** Свои задачи без отменённых: сначала открытые (по приоритету и сроку), затем ждущие подтверждения и закрытые. */
  async listForMaster(staffId: number) {
    const rows = await this.prisma.task.findMany({
      where: { staffId, status: { not: TaskStatus.CANCELLED } },
      select: taskSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const now = new Date();
    const rank = (t: { displayStatus: string }) => (t.displayStatus === "CONFIRMED" ? 2 : t.displayStatus === "DONE" ? 1 : 0);
    const items = await Promise.all(rows.map((r) => this.present(r, now)));
    return items
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity),
      );
  }

  async start(staffId: number, id: number) {
    const t = await this.requireOwnOpen(staffId, id);
    if (t.status === TaskStatus.IN_PROGRESS) return this.present(await this.get(id));
    return this.present(await this.prisma.task.update({ where: { id }, data: { status: TaskStatus.IN_PROGRESS }, select: taskSelect }));
  }

  /** Мастер отмечает «Выполнена»; задача ждёт подтверждения админом. */
  async complete(staffId: number, id: number, comment: string | undefined, login: string, req: Request) {
    await this.requireOwnOpen(staffId, id);
    const task = await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.DONE, doneAt: new Date(), masterComment: comment || null, adminComment: null },
      select: taskSelect,
    });
    await this.audit.log({ action: StaffAuditAction.TASK_DONE, actor: login, staffId, req, meta: { taskId: id } });
    return this.present(task);
  }

  // ---------- фото ----------

  /** Админ: добавить фото к задаче (кроме отменённой). */
  async addPhotoAsAdmin(taskId: number, file: Express.Multer.File | undefined, req: Request) {
    const t = await this.requireTask(taskId);
    if (t.status === TaskStatus.CANCELLED) throw new BadRequestException("Задача отменена — фото добавить нельзя");
    return this.addPhoto(t.id, t.staffId, "ADMIN", file, "admin", req);
  }

  /** Мастер: фото к своей задаче, пока она не отменена и не подтверждена админом. */
  async addPhotoAsMaster(staffId: number, login: string, taskId: number, file: Express.Multer.File | undefined, req: Request) {
    const t = await this.requireOwn(staffId, taskId);
    if (t.status === TaskStatus.CANCELLED || t.confirmedAt) throw new BadRequestException("Задача закрыта — фото добавить нельзя");
    return this.addPhoto(t.id, t.staffId, "MASTER", file, login, req);
  }

  async deletePhotoAsAdmin(taskId: number, photoId: number, req: Request) {
    const t = await this.requireTask(taskId);
    return this.deletePhoto(t.id, t.staffId, photoId, "admin", req);
  }

  /** Мастер удаляет только свои фото и только пока задача не подтверждена. */
  async deletePhotoAsMaster(staffId: number, login: string, taskId: number, photoId: number, req: Request) {
    const t = await this.requireOwn(staffId, taskId);
    if (t.confirmedAt) throw new BadRequestException("Задача подтверждена — фото удалить нельзя");
    return this.deletePhoto(t.id, t.staffId, photoId, login, req, "MASTER");
  }

  private async addPhoto(taskId: number, staffId: number, by: "ADMIN" | "MASTER", file: Express.Multer.File | undefined, actor: string, req: Request) {
    const count = await this.prisma.taskPhoto.count({ where: { taskId } });
    if (count >= MAX_TASK_PHOTOS) throw new BadRequestException(`К задаче можно прикрепить не больше ${MAX_TASK_PHOTOS} фото`);
    const photo = await normalizePhoto(file?.buffer);
    const key = `tasks/${taskId}/${randomUUID()}.${photo.ext}`;
    await this.storage.put(key, photo.data, photo.contentType);
    try {
      await this.prisma.taskPhoto.create({ data: { taskId, key, size: photo.data.length, uploadedBy: by } });
    } catch (e) {
      await this.storage.remove(key); // не оставляем сиротский объект в хранилище
      throw e;
    }
    await this.audit.log({ action: StaffAuditAction.TASK_PHOTO_ADDED, actor, staffId, req, meta: { taskId, by } });
    return this.present(await this.get(taskId));
  }

  private async deletePhoto(taskId: number, staffId: number, photoId: number, actor: string, req: Request, onlyBy?: "MASTER") {
    const photo = await this.prisma.taskPhoto.findFirst({ where: { id: photoId, taskId } });
    // чужое фото мастеру «не найдено»: не раскрываем, что оно есть
    if (!photo || (onlyBy && photo.uploadedBy !== onlyBy)) throw new NotFoundException("Фото не найдено");
    await this.prisma.taskPhoto.delete({ where: { id: photoId } });
    await this.storage.remove(photo.key);
    await this.audit.log({ action: StaffAuditAction.TASK_PHOTO_DELETED, actor, staffId, req, meta: { taskId, photoId } });
    return this.present(await this.get(taskId));
  }

  // ---------- общее ----------

  /** Ответ клиенту: вычисляемый статус + фото с прямыми ссылками (имя файла — случайный UUID; ключи объектов наружу не уходят). */
  private async present(t: TaskRow, now = new Date()) {
    const { photos, ...rest } = t;
    return {
      ...rest,
      displayStatus: taskDisplayStatus(t, now),
      photos: photos.map((p) => ({ id: p.id, url: this.storage.publicUrl(p.key), by: p.uploadedBy, createdAt: p.createdAt })),
    };
  }

  private get(id: number) {
    return this.prisma.task.findUniqueOrThrow({ where: { id }, select: taskSelect });
  }

  private async requireTask(id: number) {
    const t = await this.prisma.task.findUnique({ where: { id }, select: { id: true, staffId: true, status: true, dueAt: true, confirmedAt: true } });
    if (!t) throw new NotFoundException("Задача не найдена");
    return t;
  }

  /** Своя задача; чужая для мастера «не найдена». */
  private async requireOwn(staffId: number, id: number) {
    const t = await this.requireTask(id);
    if (t.staffId !== staffId) throw new NotFoundException("Задача не найдена");
    return t;
  }

  /** Чужую задачу не раскрываем: для мастера она «не найдена». */
  private async requireOwnOpen(staffId: number, id: number) {
    const t = await this.requireTask(id);
    if (t.staffId !== staffId) throw new NotFoundException("Задача не найдена");
    if (!isOpenForMaster(t)) throw new BadRequestException("Задача уже закрыта или ждёт подтверждения");
    return t;
  }

  private async requireActiveMaster(staffId: number) {
    const s = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { role: true, blockedAt: true, fullName: true } });
    if (!s) throw new BadRequestException("Сотрудник не найден");
    if (s.role !== StaffRole.MASTER || s.blockedAt) throw new BadRequestException(`«${s.fullName}» нельзя назначить: не мастер или заблокирован`);
  }
}
