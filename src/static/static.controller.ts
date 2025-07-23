import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';

@Controller('static')
export class StaticController {
  private readonly publicPath = join(process.cwd(), 'public');

  @Get('images/:folder')
  getImagesList(@Param('folder') folder: string) {
    const folderPath = join(this.publicPath, folder);

    if (!existsSync(folderPath)) {
      throw new NotFoundException(`Folder ${folder} not found`);
    }

    try {
      const files = readdirSync(folderPath)
        .filter((file) => {
          const filePath = join(folderPath, file);
          return (
            statSync(filePath).isFile() &&
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)
          );
        })
        .map((file) => ({
          name: file,
          url: `/static/${folder}/${file}`,
          fullUrl: `${process.env.BACKEND_BASE_URL || 'http://localhost:4444'}/static/${folder}/${file}`,
        }));

      return {
        folder,
        count: files.length,
        images: files,
      };
    } catch (error) {
      throw new NotFoundException(`Error reading folder ${folder}`);
    }
  }

  @Get('images/:folder/:filename')
  serveImage(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = join(this.publicPath, folder, filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`Image ${folder}/${filename} not found`);
    }

    return res.sendFile(filePath);
  }
}
