import { PrismaService } from '../prisma/prisma.service';
import { Brand } from 'generated/prisma';
export declare class CarsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllBrand(): Promise<Brand[]>;
}
