import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageService {
  private readonly publicDir = path.resolve(process.cwd(), 'public');

  getBlogImageUrl(filename: string): string {
    return `/api/image/blog/${filename}`;
  }

  getImageUrl(filename: string): string {
    return `/api/image/${filename}`;
  }

  checkImageExists(category: string, filename: string): boolean {
    const imagePath = path.join(this.publicDir, category, filename);
    return fs.existsSync(imagePath);
  }

  checkBlogImageExists(filename: string): boolean {
    const imagePath = path.join(this.publicDir, 'blog', filename);
    return fs.existsSync(imagePath);
  }

  listBlogImages(): string[] {
    const blogDir = path.join(this.publicDir, 'blog');
    if (!fs.existsSync(blogDir)) {
      return [];
    }
    return fs.readdirSync(blogDir).filter(file => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );
  }

  getImagePath(category: string, filename: string): string {
    return path.join(this.publicDir, category, filename);
  }

  getBlogImagePath(filename: string): string {
    return path.join(this.publicDir, 'blog', filename);
  }
}
