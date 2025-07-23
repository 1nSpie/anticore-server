import { IsString, IsOptional, IsBoolean, IsInt, IsArray } from 'class-validator';

export class CreateWorkDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  beforeImage?: string;

  @IsOptional()
  @IsString()
  afterImage?: string;

  @IsString()
  duration: string;

  @IsString()
  year: string;

  @IsString()
  carBrand: string;

  @IsString()
  carModel: string;

  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  services?: string[];

  @IsOptional()
  @IsArray()
  images?: { url: string; alt?: string; order?: number }[];
}

export class UpdateWorkDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  beforeImage?: string;

  @IsOptional()
  @IsString()
  afterImage?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  carBrand?: string;

  @IsOptional()
  @IsString()
  carModel?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  services?: string[];

  @IsOptional()
  @IsArray()
  images?: { url: string; alt?: string; order?: number }[];
}

export class CreateWorkCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;
}

export class UpdateWorkCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;
}
