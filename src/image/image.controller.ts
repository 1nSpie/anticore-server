import { Controller, Get, Param, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { ImageService } from './image.service';

@Controller('image')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}
  @Get('blog/:filename')
  getBlogImage(@Param('filename') filename: string, @Res() res: Response) {
    const imagePath = this.imageService.getBlogImagePath(filename);

    console.log('Requested filename:', filename);
    console.log('Resolved path:', imagePath);
    console.log('File exists:', fs.existsSync(imagePath));

    if (!fs.existsSync(imagePath)) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ error: 'Blog image not found', path: imagePath });
    }

    res.sendFile(imagePath);
  }

  @Get('blog')
  listBlogImages() {
    return {
      images: this.imageService.listBlogImages(),
      total: this.imageService.listBlogImages().length,
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

    res.sendFile(imagePath);
  }
}
