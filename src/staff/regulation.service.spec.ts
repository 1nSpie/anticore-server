import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { MAX_PDF_BYTES, RegulationService, isPdf, makeSnippet } from "./regulation.service";

const PDF = Buffer.from("%PDF-1.7\n%…");

describe("isPdf / makeSnippet", () => {
  it("PDF определяется по сигнатуре, а не по имени", () => {
    expect(isPdf(PDF)).toBe(true);
    expect(isPdf(Buffer.from("MZ\x90\x00 exe"))).toBe(false);
    expect(isPdf(Buffer.from("<html>%PDF-</html>"))).toBe(false);
    expect(isPdf(Buffer.alloc(0))).toBe(false);
  });

  it("сниппет — кусок вокруг совпадения без учёта регистра; нет совпадения — null", () => {
    const text = "а".repeat(200) + " Охрана труда: каски обязательны " + "б".repeat(200);
    const sn = makeSnippet(text, "ОХРАНА")!;
    expect(sn).toContain("Охрана труда");
    expect(sn.startsWith("…") && sn.endsWith("…")).toBe(true);
    expect(sn.length).toBeLessThan(220);
    expect(makeSnippet("пусто", "каска")).toBeNull();
  });
});

function setup(over: Record<string, any> = {}) {
  const state = { id: 1, version: 3, changeNote: null, publishedAt: null, dirty: false };
  const prisma: any = {
    regulationState: {
      upsert: jest.fn(async () => state),
      update: jest.fn(async ({ data }) => ({ ...state, ...data, version: data.version?.increment ? state.version + 1 : state.version })),
    },
    regSection: { findUnique: jest.fn(async () => null), create: jest.fn(async ({ data }) => ({ id: 1, ...data })), count: jest.fn(async () => 0), delete: jest.fn() },
    regArticle: { findUnique: jest.fn(async () => ({ id: 9, attachments: [] })), count: jest.fn(async () => 0), create: jest.fn(), delete: jest.fn() },
    regAttachment: { create: jest.fn(async ({ data }) => ({ id: 1, fileName: data.fileName })), findUnique: jest.fn(), delete: jest.fn() },
    staff: { update: jest.fn(async () => undefined), findUnique: jest.fn(async () => ({ regulationAckVersion: 0 })) },
    ...over,
  };
  const audit: any = { log: jest.fn(async () => undefined) };
  const notifications: any = { notifyAllMasters: jest.fn(async () => undefined) };
  return { prisma, audit, notifications, svc: new RegulationService(prisma, audit, notifications) };
}

describe("RegulationService — структура", () => {
  it("подраздел можно создать только в разделе верхнего уровня (глубина 2)", async () => {
    const root = setup();
    root.prisma.regSection.findUnique.mockResolvedValue({ parentId: null });
    await expect(root.svc.createSection({ title: "Подраздел", parentId: 1 }, {} as any)).resolves.toBeDefined();

    const nested = setup();
    nested.prisma.regSection.findUnique.mockResolvedValue({ parentId: 1 });
    await expect(nested.svc.createSection({ title: "Слишком глубоко", parentId: 2 }, {} as any)).rejects.toBeInstanceOf(BadRequestException);

    const missing = setup();
    await expect(missing.svc.createSection({ title: "x", parentId: 99 }, {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("непустой раздел удалить нельзя", async () => {
    const a = setup();
    a.prisma.regSection.findUnique.mockResolvedValue({ id: 1 });
    a.prisma.regArticle.count.mockResolvedValue(2);
    await expect(a.svc.deleteSection(1, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(a.prisma.regSection.delete).not.toHaveBeenCalled();

    const b = setup();
    b.prisma.regSection.findUnique.mockResolvedValue({ id: 1 });
    await b.svc.deleteSection(1, {} as any);
    expect(b.prisma.regSection.delete).toHaveBeenCalled();
  });

  it("любая правка помечает регламент неопубликованным и пишется в журнал", async () => {
    const { svc, prisma, audit } = setup();
    prisma.regSection.findUnique.mockResolvedValue({ id: 1 });
    prisma.regArticle.create.mockResolvedValue({ id: 9, title: "t" });
    await svc.createArticle({ sectionId: 1, title: "Каски" }, {} as any);
    expect(prisma.regulationState.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { dirty: true } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "REGULATION_CHANGED" }));
  });
});

describe("RegulationService — вложения", () => {
  const file = (buf: Buffer, name = "doc.pdf") => ({ buffer: buf, originalname: name }) as any;

  it("принимает PDF и возвращает кириллическое имя (multer отдаёт latin1)", async () => {
    const { svc, prisma } = setup();
    const latin1 = Buffer.from("Правила.pdf", "utf8").toString("latin1");
    await svc.addAttachment(9, file(PDF, latin1), {} as any);
    expect(prisma.regAttachment.create.mock.calls[0][0].data.fileName).toBe("Правила.pdf");
  });

  it("отклоняет не-PDF под видом .pdf, пустой и слишком большой файл", async () => {
    const { svc } = setup();
    await expect(svc.addAttachment(9, file(Buffer.from("MZ\x90 exe"), "evil.pdf"), {} as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.addAttachment(9, undefined, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    const big = Buffer.concat([PDF, Buffer.alloc(MAX_PDF_BYTES)]);
    await expect(svc.addAttachment(9, file(big), {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("имя файла очищается от символов, ломающих заголовки", async () => {
    const { svc, prisma } = setup();
    await svc.addAttachment(9, file(PDF, 'a"b\r\nc.pdf'), {} as any);
    expect(prisma.regAttachment.create.mock.calls[0][0].data.fileName).not.toMatch(/["\r\n]/);
  });

  it("несуществующее вложение → 404", async () => {
    const { svc } = setup();
    await expect(svc.attachment(1)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("RegulationService — версия и ознакомление", () => {
  it("публикация увеличивает версию, снимает «неопубликовано» и пишет заметку в журнал", async () => {
    const { svc, prisma, audit } = setup();
    await svc.publish("Новые правила по каскам", {} as any);
    expect(prisma.regulationState.update.mock.calls[0][0].data).toMatchObject({ version: { increment: 1 }, dirty: false, changeNote: "Новые правила по каскам" });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "REGULATION_PUBLISHED" }));
  });

  it("публикация сразу уведомляет всех мастеров и ведёт на экран регламента", async () => {
    const { svc, notifications } = setup();
    await svc.publish("Новые правила", {} as any);
    expect(notifications.notifyAllMasters).toHaveBeenCalledWith(
      expect.objectContaining({ type: "REGULATION", body: "Новые правила", link: "/admin/master/regulation" }),
    );
  });

  it("обычная правка (без публикации) мастеров не уведомляет", async () => {
    const { svc, prisma, notifications } = setup();
    prisma.regSection.findUnique.mockResolvedValue({ id: 1 });
    prisma.regArticle.create.mockResolvedValue({ id: 9, title: "t" });
    await svc.createArticle({ sectionId: 1, title: "Черновик" }, {} as any);
    expect(notifications.notifyAllMasters).not.toHaveBeenCalled();
  });

  it("ознакомление фиксируется только для актуальной версии", async () => {
    const { svc, prisma, audit } = setup();
    await expect(svc.ack(7, "ivan", 2, {} as any)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.staff.update).not.toHaveBeenCalled();
    await svc.ack(7, "ivan", 3, {} as any);
    expect(prisma.staff.update.mock.calls[0][0].data).toMatchObject({ regulationAckVersion: 3 });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "REGULATION_ACKED", meta: { version: 3 } }));
  });

  it("статус: требуется ознакомление, пока версия мастера меньше актуальной", async () => {
    const { svc, prisma } = setup();
    expect((await svc.statusFor(7)).ackRequired).toBe(true);
    prisma.staff.findUnique.mockResolvedValue({ regulationAckVersion: 3 });
    expect((await svc.statusFor(7)).ackRequired).toBe(false);
  });
});
