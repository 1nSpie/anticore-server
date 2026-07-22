import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateVisitDto {
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  serviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diskLink?: string;
}
