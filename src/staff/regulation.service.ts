import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateArticleDto,
  CreateSectionDto,
  UpdateArticleDto,
  UpdateSectionDto,
} from "./dto/regulation.dto";
import { NotificationType, MASTER_REGULATION } from "./notification-types";
import { NotificationsService } from "./notifications.service";
import { StaffAuditAction, StaffAuditService } from "./staff-audit.service";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
const SNIPPET_RADIUS = 80;

/** Сигнатура PDF: файл должен начинаться с `%PDF-` (расширению и Content-Type верить нельзя). */
export function isPdf(buf: Buffer): boolean {
  return buf.length > 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Кусок текста вокруг первого совпадения — для выдачи поиска (подсветку рисует клиент). */
export function makeSnippet(text: string, q: string): string | null {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return null;
  const from = Math.max(0, i - SNIPPET_RADIUS);
  const to = Math.min(text.length, i + q.length + SNIPPET_RADIUS);
  return `${from > 0 ? "…" : ""}${text.slice(from, to).replace(/\s+/g, " ").trim()}${to < text.length ? "…" : ""}`;
}

const attachmentMeta = { id: true, fileName: true, size: true, createdAt: true } as const;

@Injectable()
export class RegulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- чтение (админ и мастер) ----------

  /** Дерево «раздел → подраздел → статьи» без текста статей и без содержимого вложений. */
  async tree() {
    const sections = await this.prisma.regSection.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        parentId: true,
        title: true,
        sortOrder: true,
        articles: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true, title: true, sortOrder: true, _count: { select: { attachments: true } } },
        },
      },
    });
    const shape = (s: (typeof sections)[number]) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sortOrder,
      articles: s.articles.map((a) => ({ id: a.id, title: a.title, sortOrder: a.sortOrder, attachments: a._count.attachments })),
    });
    return sections
      .filter((s) => s.parentId === null)
      .map((s) => ({ ...shape(s), children: sections.filter((c) => c.parentId === s.id).map(shape) }));
  }

  async article(id: number) {
    const a = await this.prisma.regArticle.findUnique({
      where: { id },
      select: {
        id: true,
        sectionId: true,
        title: true,
        body: true,
        sortOrder: true,
        updatedAt: true,
        section: { select: { title: true } },
        attachments: { select: attachmentMeta, orderBy: { id: "asc" } },
      },
    });
    if (!a) throw new NotFoundException("Статья не найдена");
    return a;
  }

  /** Поиск по заголовкам разделов и статей и по тексту. Морфологии нет — подстрока без учёта регистра. */
  async search(q: string) {
    const rows = await this.prisma.regArticle.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
          { section: { title: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 30,
      orderBy: { id: "asc" },
      select: { id: true, title: true, body: true, section: { select: { title: true } } },
    });
    return rows
      .map((r) => ({
        id: r.id,
        title: r.title,
        sectionTitle: r.section.title,
        snippet: makeSnippet(r.body, q),
        inTitle: r.title.toLowerCase().includes(q.toLowerCase()),
      }))
      // совпадения в заголовке выше, чем в тексте
      .sort((a, b) => Number(b.inTitle) - Number(a.inTitle));
  }

  async attachment(id: number) {
    const a = await this.prisma.regAttachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException("Вложение не найдено");
    return a;
  }

  // ---------- версия и ознакомление ----------

  async state() {
    return this.prisma.regulationState.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  /** Состояние для мастера: нужно ли ознакомиться. */
  async statusFor(staffId: number) {
    const [state, staff] = await Promise.all([
      this.state(),
      this.prisma.staff.findUnique({ where: { id: staffId }, select: { regulationAckVersion: true, regulationAckAt: true } }),
    ]);
    const acked = staff?.regulationAckVersion ?? 0;
    return {
      version: state.version,
      ackedVersion: acked,
      ackRequired: state.version > acked,
      changeNote: state.changeNote,
      publishedAt: state.publishedAt,
    };
  }

  async ack(staffId: number, login: string, version: number, req: Request) {
    const state = await this.state();
    if (version !== state.version) throw new ConflictException("Регламент обновился — откройте актуальную версию");
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { regulationAckVersion: version, regulationAckAt: new Date() },
    });
    await this.audit.log({ action: StaffAuditAction.REGULATION_ACKED, actor: login, staffId, req, meta: { version } });
    return this.statusFor(staffId);
  }

  /** Опубликовать: версия растёт, все мастера обязаны ознакомиться заново. */
  async publish(note: string | undefined, req: Request) {
    await this.state();
    const state = await this.prisma.regulationState.update({
      where: { id: 1 },
      data: { version: { increment: 1 }, changeNote: note || null, publishedAt: new Date(), dirty: false },
    });
    await this.audit.log({
      action: StaffAuditAction.REGULATION_PUBLISHED,
      actor: "admin",
      req,
      meta: { version: state.version, note: note || null },
    });
    // Всем мастерам сразу (ТЗ 4.2): до ознакомления работа заблокирована
    await this.notifications.notifyAllMasters({
      type: NotificationType.REGULATION,
      title: "Регламент изменён — ознакомьтесь",
      body: note || null,
      link: MASTER_REGULATION,
    });
    return state;
  }

  // ---------- правки (админ) ----------

  async createSection(dto: CreateSectionDto, req: Request) {
    if (dto.parentId) {
      const parent = await this.prisma.regSection.findUnique({ where: { id: dto.parentId }, select: { parentId: true } });
      if (!parent) throw new BadRequestException("Родительский раздел не найден");
      if (parent.parentId !== null) throw new BadRequestException("Допустимы только раздел и подраздел — глубже нельзя");
    }
    const section = await this.prisma.regSection.create({ data: { title: dto.title, parentId: dto.parentId ?? null } });
    await this.touched("SECTION_CREATED", { sectionId: section.id, title: section.title }, req);
    return section;
  }

  async updateSection(id: number, dto: UpdateSectionDto, req: Request) {
    await this.requireSection(id);
    const section = await this.prisma.regSection.update({ where: { id }, data: { title: dto.title, sortOrder: dto.sortOrder } });
    await this.touched("SECTION_UPDATED", { sectionId: id }, req);
    return section;
  }

  async deleteSection(id: number, req: Request) {
    await this.requireSection(id);
    const [children, articles] = await Promise.all([
      this.prisma.regSection.count({ where: { parentId: id } }),
      this.prisma.regArticle.count({ where: { sectionId: id } }),
    ]);
    if (children || articles) throw new BadRequestException("Раздел не пуст: сначала удалите или перенесите подразделы и статьи");
    await this.prisma.regSection.delete({ where: { id } });
    await this.touched("SECTION_DELETED", { sectionId: id }, req);
    return { success: true };
  }

  async createArticle(dto: CreateArticleDto, req: Request) {
    await this.requireSection(dto.sectionId);
    const article = await this.prisma.regArticle.create({ data: { sectionId: dto.sectionId, title: dto.title, body: dto.body ?? "" } });
    await this.touched("ARTICLE_CREATED", { articleId: article.id, title: article.title }, req);
    return this.article(article.id);
  }

  async updateArticle(id: number, dto: UpdateArticleDto, req: Request) {
    await this.article(id);
    if (dto.sectionId) await this.requireSection(dto.sectionId);
    await this.prisma.regArticle.update({
      where: { id },
      data: { sectionId: dto.sectionId, title: dto.title, body: dto.body, sortOrder: dto.sortOrder },
    });
    await this.touched("ARTICLE_UPDATED", { articleId: id }, req);
    return this.article(id);
  }

  async deleteArticle(id: number, req: Request) {
    await this.article(id);
    await this.prisma.regArticle.delete({ where: { id } });
    await this.touched("ARTICLE_DELETED", { articleId: id }, req);
    return { success: true };
  }

  async addAttachment(articleId: number, file: Express.Multer.File | undefined, req: Request) {
    await this.article(articleId);
    if (!file?.buffer?.length) throw new BadRequestException("Выберите PDF-файл");
    if (file.buffer.length > MAX_PDF_BYTES) throw new BadRequestException("Максимальный размер — 10 МБ");
    if (!isPdf(file.buffer)) throw new BadRequestException("Нужен PDF-файл");
    // multer отдаёт имя в latin1 — возвращаем кириллицу
    const fileName = Buffer.from(file.originalname, "latin1").toString("utf8").replace(/[\r\n\\/"]/g, "_").slice(0, 200) || "document.pdf";
    const saved = await this.prisma.regAttachment.create({
      data: { articleId, fileName, size: file.buffer.length, data: file.buffer },
      select: attachmentMeta,
    });
    await this.touched("ATTACHMENT_ADDED", { articleId, attachmentId: saved.id, fileName }, req);
    return saved;
  }

  async deleteAttachment(id: number, req: Request) {
    const a = await this.attachment(id);
    await this.prisma.regAttachment.delete({ where: { id } });
    await this.touched("ATTACHMENT_DELETED", { articleId: a.articleId, attachmentId: id }, req);
    return { success: true };
  }

  // ---------- внутреннее ----------

  /** Любая правка помечает регламент «есть неопубликованные изменения» и пишется в журнал. */
  private async touched(what: string, meta: Record<string, unknown>, req: Request) {
    await this.state();
    await this.prisma.regulationState.update({ where: { id: 1 }, data: { dirty: true } });
    await this.audit.log({ action: StaffAuditAction.REGULATION_CHANGED, actor: "admin", req, meta: { what, ...meta } as never });
  }

  private async requireSection(id: number) {
    const s = await this.prisma.regSection.findUnique({ where: { id }, select: { id: true } });
    if (!s) throw new NotFoundException("Раздел не найден");
  }
}
