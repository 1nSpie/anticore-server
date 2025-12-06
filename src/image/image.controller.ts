import { Controller, Get, Param, Res, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { ImageService } from './image.service';

@Controller('image')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(private readonly imageService: ImageService) {}
  @Get('blog/:filename')
  getBlogImage(@Param('filename') filename: string, @Res() res: Response) {
    const imagePath = this.imageService.getBlogImagePath(filename);

    if (!fs.existsSync(imagePath)) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ error: 'Blog image not found', path: imagePath });
    }

    res.sendFile(imagePath, (error) => {
      if (error && !res.headersSent) {
        this.logger.error(`Error sending blog image ${filename}:`, error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Error sending image',
        });
      }
    });
  }

  @Get('blog')
  listBlogImages() {
    const images = this.imageService.listBlogImages();
    return {
      images,
      total: images.length,
    };
  }

  @Get(':filename')
  getImage(@Param('filename') filename: string, @Res() res: Response) {
    const imagePath = this.imageService.getImagePath('', filename);

    if (!fs.existsSync(imagePath)) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ error: 'Image not found' });
    }

    res.sendFile(imagePath, (error) => {
      if (error && !res.headersSent) {
        this.logger.error(`Error sending image ${filename}:`, error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Error sending image',
        });
      }
    });
  }
}
