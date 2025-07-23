import { WorksService } from './works.service';
import { CreateWorkDto, UpdateWorkDto, CreateWorkCategoryDto, UpdateWorkCategoryDto } from './dto/work.dto';
export declare class WorksController {
    private readonly worksService;
    constructor(worksService: WorksService);
    createWork(createWorkDto: CreateWorkDto): Promise<{
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
        services: {
            id: number;
            name: string;
            workId: number;
        }[];
        images: {
            id: number;
            url: string;
            alt: string | null;
            order: number;
            workId: number;
        }[];
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        categoryId: number;
        featured: boolean;
        published: boolean;
        description: string;
        beforeImage: string | null;
        afterImage: string | null;
        duration: string;
        year: string;
        carBrand: string;
        carModel: string;
    }>;
    findAllWorks(categoryId?: string, featured?: string, published?: string): Promise<({
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
        services: {
            id: number;
            name: string;
            workId: number;
        }[];
        images: {
            id: number;
            url: string;
            alt: string | null;
            order: number;
            workId: number;
        }[];
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        categoryId: number;
        featured: boolean;
        published: boolean;
        description: string;
        beforeImage: string | null;
        afterImage: string | null;
        duration: string;
        year: string;
        carBrand: string;
        carModel: string;
    })[]>;
    getWorksStats(): Promise<{
        totalWorks: number;
        publishedWorks: number;
        featuredWorks: number;
    }>;
    findWorkBySlug(slug: string): Promise<{
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
        services: {
            id: number;
            name: string;
            workId: number;
        }[];
        images: {
            id: number;
            url: string;
            alt: string | null;
            order: number;
            workId: number;
        }[];
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        categoryId: number;
        featured: boolean;
        published: boolean;
        description: string;
        beforeImage: string | null;
        afterImage: string | null;
        duration: string;
        year: string;
        carBrand: string;
        carModel: string;
    }>;
    findWorkById(id: number): Promise<{
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
        services: {
            id: number;
            name: string;
            workId: number;
        }[];
        images: {
            id: number;
            url: string;
            alt: string | null;
            order: number;
            workId: number;
        }[];
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        categoryId: number;
        featured: boolean;
        published: boolean;
        description: string;
        beforeImage: string | null;
        afterImage: string | null;
        duration: string;
        year: string;
        carBrand: string;
        carModel: string;
    }>;
    updateWork(id: number, updateWorkDto: UpdateWorkDto): Promise<{
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
        services: {
            id: number;
            name: string;
            workId: number;
        }[];
        images: {
            id: number;
            url: string;
            alt: string | null;
            order: number;
            workId: number;
        }[];
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        categoryId: number;
        featured: boolean;
        published: boolean;
        description: string;
        beforeImage: string | null;
        afterImage: string | null;
        duration: string;
        year: string;
        carBrand: string;
        carModel: string;
    }>;
    deleteWork(id: number): Promise<{
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        categoryId: number;
        featured: boolean;
        published: boolean;
        description: string;
        beforeImage: string | null;
        afterImage: string | null;
        duration: string;
        year: string;
        carBrand: string;
        carModel: string;
    }>;
    createWorkCategory(createCategoryDto: CreateWorkCategoryDto): Promise<{
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAllWorkCategories(): Promise<({
        works: {
            id: number;
            title: string;
        }[];
    } & {
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findWorkCategoryById(id: number): Promise<{
        works: ({
            services: {
                id: number;
                name: string;
                workId: number;
            }[];
            images: {
                id: number;
                url: string;
                alt: string | null;
                order: number;
                workId: number;
            }[];
        } & {
            id: number;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            categoryId: number;
            featured: boolean;
            published: boolean;
            description: string;
            beforeImage: string | null;
            afterImage: string | null;
            duration: string;
            year: string;
            carBrand: string;
            carModel: string;
        })[];
    } & {
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateWorkCategory(id: number, updateCategoryDto: UpdateWorkCategoryDto): Promise<{
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteWorkCategory(id: number): Promise<{
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
