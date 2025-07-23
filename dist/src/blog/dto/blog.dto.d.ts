export declare class CreateBlogPostDto {
    title: string;
    excerpt: string;
    content: string;
    slug: string;
    readTime: string;
    categoryId: number;
    image?: string;
    author?: string;
    featured?: boolean;
    published?: boolean;
    tags?: string[];
}
export declare class UpdateBlogPostDto {
    title?: string;
    excerpt?: string;
    content?: string;
    slug?: string;
    readTime?: string;
    categoryId?: number;
    image?: string;
    author?: string;
    featured?: boolean;
    published?: boolean;
    tags?: string[];
}
export declare class CreateCategoryDto {
    name: string;
    slug: string;
}
export declare class CreateTagDto {
    name: string;
    slug: string;
}
export declare class BlogQueryDto {
    category?: string;
    tag?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
}
