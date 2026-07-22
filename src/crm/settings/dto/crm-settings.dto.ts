import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class UpdateSmsTemplatesDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsString()
  @MaxLength(2000)
  appointment!: string;

  @IsString()
  @MaxLength(2000)
  review!: string;

  @IsString()
  @MaxLength(2000)
  birthday!: string;
}

export class ServiceTypeItemDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  active?: boolean;
}

export class UpdateServiceTypesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceTypeItemDto)
  items!: ServiceTypeItemDto[];
}
