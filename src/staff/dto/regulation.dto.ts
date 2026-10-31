import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const int = () => Type(() => Number);

export class CreateSectionDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  /** Подраздел — указать родительский раздел (глубина не больше двух уровней). */
  @IsOptional()
  @int()
  @IsInt()
  @Min(1)
  parentId?: number;
}

export class UpdateSectionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @int()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class CreateArticleDto {
  @int()
  @IsInt()
  @Min(1)
  sectionId!: number;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  body?: string;
}

export class UpdateArticleDto {
  @IsOptional()
  @int()
  @IsInt()
  @Min(1)
  sectionId?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  body?: string;

  @IsOptional()
  @int()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class PublishDto {
  /** Что изменилось — мастера увидят это при ознакомлении. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AckDto {
  /** Версия регламента, с которой знакомится мастер (защита от «согласился со старой»). */
  @int()
  @IsInt()
  @Min(1)
  version!: number;
}

export class SearchQueryDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;
}
