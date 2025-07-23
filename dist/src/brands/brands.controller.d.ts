import { PrismaService } from '../prisma/prisma.service';
export declare class BrandsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllCarWithBrand(id: string): Promise<{
        prices: {
            id: number;
            segment: number;
            standartML: number | null;
            standartMLBody: number | null;
            complexML: number | null;
            complexMLBody: number | null;
        } | null;
        id: number;
        model: string;
        brandId: number | null;
        segment: number;
    }[]>;
}
