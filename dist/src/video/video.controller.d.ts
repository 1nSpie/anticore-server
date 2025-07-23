import { Request, Response } from 'express';
export declare class VideoController {
    streamVideo(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
}
