import { BlogService } from './blog.service';
import { CreateBlogPostDto, UpdateBlogPostDto, CreateCategoryDto, CreateTagDto, BlogQueryDto } from './dto/blog.dto';
export declare class BlogController {
    private readonly blogService;
    constructor(blogService: BlogService);
    createPost(createPostDto: CreateBlogPostDto): Promise<{
        tags: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        excerpt: string;
        content: string;
        readTime: string;
        categoryId: number;
        featured: boolean;
        image: string | null;
        date: Date;
        author: string;
        published: boolean;
    }>;
    findAllPosts(query: BlogQueryDto): Promise<{
        posts: ({
            tags: {
                id: number;
                name: string;
                slug: string;
                createdAt: Date;
                updatedAt: Date;
            }[];
            category: {
                id: number;
                name: string;
                slug: string;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: number;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            excerpt: string;
            content: string;
            readTime: string;
            categoryId: number;
            featured: boolean;
            image: string | null;
            date: Date;
            author: string;
            published: boolean;
        })[];
        total: number;
        hasMore: boolean;
    }>;
    getFeaturedPost(): Promise<({
        tags: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        excerpt: string;
        content: string;
        readTime: string;
        categoryId: number;
        featured: boolean;
        image: string | null;
        date: Date;
        author: string;
        published: boolean;
    }) | null>;
    findPostById(id: number): Promise<{
        tags: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        excerpt: string;
        content: string;
        readTime: string;
        categoryId: number;
        featured: boolean;
        image: string | null;
        date: Date;
        author: string;
        published: boolean;
    }>;
    findPostBySlug(slug: string): Promise<{
        tags: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        excerpt: string;
        content: string;
        readTime: string;
        categoryId: number;
        featured: boolean;
        image: string | null;
        date: Date;
        author: string;
        published: boolean;
    }>;
    getRelatedPosts(id: number): Promise<({
        tags: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        excerpt: string;
        content: string;
        readTime: string;
        categoryId: number;
        featured: boolean;
        image: string | null;
        date: Date;
        author: string;
        published: boolean;
    })[]>;
    updatePost(id: number, updatePostDto: UpdateBlogPostDto): Promise<{
        tags: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        category: {
            id: number;
            name: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        excerpt: string;
        content: string;
        readTime: string;
        categoryId: number;
        featured: boolean;
        image: string | null;
        date: Date;
        author: string;
        published: boolean;
    }>;
    deletePost(id: number): Promise<{
        id: number;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        excerpt: string;
        content: string;
        readTime: string;
        categoryId: number;
        featured: boolean;
        image: string | null;
        date: Date;
        author: string;
        published: boolean;
    }>;
    createCategory(createCategoryDto: CreateCategoryDto): Promise<{
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAllCategories(): Promise<({
        _count: {
            posts: number;
        };
    } & {
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findCategoryById(id: number): Promise<{
        posts: ({
            tags: {
                id: number;
                name: string;
                slug: string;
                createdAt: Date;
                updatedAt: Date;
            }[];
            category: {
                id: number;
                name: string;
                slug: string;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: number;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            excerpt: string;
            content: string;
            readTime: string;
            categoryId: number;
            featured: boolean;
            image: string | null;
            date: Date;
            author: string;
            published: boolean;
        })[];
    } & {
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createTag(createTagDto: CreateTagDto): Promise<{
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAllTags(): Promise<({
        _count: {
            posts: number;
        };
    } & {
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    getStats(): Promise<{
        totalPosts: number;
        totalCategories: number;
        totalTags: number;
        featuredPosts: number;
    }>;
}
