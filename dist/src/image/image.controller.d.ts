import { Response } from 'express';
import { ImageService } from './image.service';
export declare class ImageController {
    private readonly imageService;
    constructor(imageService: ImageService);
    getBlogImage(filename: string, res: Response): Response<any, Record<string, any>> | undefined;
    listBlogImages(): {
        images: string[];
        total: number;
    };
    getImage(filename: string, res: Response): Response<any, Record<string, any>> | undefined;
}
