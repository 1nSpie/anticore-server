import { PrismaService } from '../prisma/prisma.service';
export declare class CarsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllCars(): import(".prisma/client").Prisma.PrismaPromise<({
        brand: {
            id: number;
            name: string;
        } | null;
    } & {
        id: number;
        segment: number;
        model: string;
        brandId: number | null;
    })[]>;
    findAllBrands(): import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        name: string;
    }[]>;
}
