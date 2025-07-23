export declare class ImageService {
    private readonly publicDir;
    getBlogImageUrl(filename: string): string;
    getImageUrl(filename: string): string;
    checkImageExists(category: string, filename: string): boolean;
    checkBlogImageExists(filename: string): boolean;
    listBlogImages(): string[];
    getImagePath(category: string, filename: string): string;
    getBlogImagePath(filename: string): string;
}
