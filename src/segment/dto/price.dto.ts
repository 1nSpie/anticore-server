import { IsOptional, IsInt, Min } from 'class-validator';

export class UpdatePriceDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  standartML?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  standartMLBody?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  complexML?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  complexMLBody?: number;
}

