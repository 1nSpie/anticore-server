export interface ImageOptimizationOptions {
    width?: number;
    quality?: number;
    format?: string;
}
export interface OptimizedImageResult {
    buffer: Buffer;
    format: string;
    fromCache: boolean;
}
export declare class ImageOptimizationService {
    private readonly logger;
    private readonly imageCache;
    private readonly MAX_CACHE_SIZE;
    private readonly MAX_WIDTH;
    private readonly DEFAULT_QUALITY;
    optimizeImage(filePath: string, options?: ImageOptimizationOptions): Promise<OptimizedImageResult>;
    private cacheImage;
    getMimeType(format: string): string;
    private getFileExtension;
    private getOptimalFormat;
    getCacheStats(): {
        cacheSize: number;
        maxCacheSize: number;
        cacheKeys: string[];
    };
    clearCache(): void;
}
