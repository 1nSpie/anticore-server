import { Response } from "express";
import { ImageOptimizationService } from "./image-optimization.service";
export declare class StaticController {
    private readonly imageOptimizationService;
    private readonly logger;
    private readonly publicPath;
    constructor(imageOptimizationService: ImageOptimizationService);
    getImagesList(folder: string): {
        folder: string;
        count: number;
        images: {
            name: string;
            url: string;
            fullUrl: string;
        }[];
    };
    serveImage(folder: string, filename: string, res: Response, width?: string, quality?: string, format?: string): Promise<void | Response<any, Record<string, any>>>;
    getCacheStats(): {
        cacheSize: number;
        maxCacheSize: number;
        cacheKeys: string[];
    };
    clearCache(): {
        message: string;
    };
    private setImageHeaders;
    private getFileExtension;
}
