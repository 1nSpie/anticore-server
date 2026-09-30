import { WorksService } from "./works.service";
import { PrismaService } from "../prisma/prisma.service";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateWorkDto } from "./dto/work.dto";

describe("Work editing", () => {
  it("replaces gallery and services in one atomic nested write, including clearing", async () => {
    const update = jest.fn().mockResolvedValue({ id: 1 });
    const service = new WorksService({
      work: { update },
    } as unknown as PrismaService);
    await service.updateWork(1, { images: [], services: [] });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          images: { deleteMany: {}, create: [] },
          services: { deleteMany: {}, create: [] },
        },
      }),
    );
  });
  it("preserves the gallery when omitted", async () => {
    const update = jest.fn().mockResolvedValue({ id: 1 });
    const service = new WorksService({
      work: { update },
    } as unknown as PrismaService);
    await service.updateWork(1, { title: "Changed" });
    expect(update.mock.calls[0][0].data).toEqual({ title: "Changed" });
  });
  it("validates nested images and rejects overlong galleries", async () => {
    expect(
      await validate(
        plainToInstance(UpdateWorkDto, { images: [{ url: 123 }] }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(UpdateWorkDto, {
          images: Array(21).fill({ url: "works/x.webp" }),
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(UpdateWorkDto, {
          images: [{ url: "works/x.webp", order: 0 }],
          services: ["Мойка"],
        }),
      ),
    ).toHaveLength(0);
  });
});
