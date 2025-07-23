import { Response } from 'express';
export declare class StaticController {
    private readonly publicPath;
    getImagesList(folder: string): {
        folder: string;
        count: number;
        images: {
            name: string;
            url: string;
            fullUrl: string;
        }[];
    };
    serveImage(folder: string, filename: string, res: Response): void;
}
