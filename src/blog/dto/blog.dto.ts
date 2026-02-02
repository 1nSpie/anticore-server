import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ContentBlockDto {
  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsString()
  text: string;
}

export class CreateBlogPostDto {
  @IsString()
  title: string;

  @IsString()
  excerpt: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentBlockDto)
  content: ContentBlockDto[];

  @IsString()
  slug: string;

  @IsString()
  readTime: string;

  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentBlockDto)
  content?: ContentBlockDto[];

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  readTime?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;
}

export class CreateTagDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;
}

export class BlogQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
