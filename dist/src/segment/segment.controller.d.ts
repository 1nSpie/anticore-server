import { PrismaService } from 'src/prisma/prisma.service';
export declare class SegmentController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findOne(id: string): import(".prisma/client").Prisma.Prisma__BodyTypePriceClient<{
        id: number;
        segment: number;
        standartML: number | null;
        standartMLBody: number | null;
        complexML: number | null;
        complexMLBody: number | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
}
