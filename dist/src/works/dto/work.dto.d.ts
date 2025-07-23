export declare class CreateWorkDto {
    title: string;
    description: string;
    slug: string;
    beforeImage?: string;
    afterImage?: string;
    duration: string;
    year: string;
    carBrand: string;
    carModel: string;
    categoryId: number;
    featured?: boolean;
    published?: boolean;
    services?: string[];
    images?: {
        url: string;
        alt?: string;
        order?: number;
    }[];
}
export declare class UpdateWorkDto {
    title?: string;
    description?: string;
    slug?: string;
    beforeImage?: string;
    afterImage?: string;
    duration?: string;
    year?: string;
    carBrand?: string;
    carModel?: string;
    categoryId?: number;
    featured?: boolean;
    published?: boolean;
    services?: string[];
    images?: {
        url: string;
        alt?: string;
        order?: number;
    }[];
}
export declare class CreateWorkCategoryDto {
    name: string;
    slug: string;
}
export declare class UpdateWorkCategoryDto {
    name?: string;
    slug?: string;
}
