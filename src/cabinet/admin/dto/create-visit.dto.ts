import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateVisitDto {
  /** Дата визита YYYY-MM-DD */
  @IsDateString()
  visitDate!: string;

  @IsString()
  @MaxLength(300)
  serviceType!: string;

  /** Ссылка на Яндекс.Диск и т.п. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diskLink?: string;
}
