import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

export class BroadcastSmsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;

  /** Конкретные ID; если не задано — все подходящие по фильтрам */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Type(() => Number)
  userIds?: number[];

  /** Фильтр по телефону (как в списке клиентов) */
  @IsOptional()
  @IsString()
  q?: string;

  /** Не отправлять тем, у кого отключены SMS (по умолчанию true) */
  @IsOptional()
  @IsBoolean()
  respectSmsOptOut?: boolean;

  /** Пропускать заблокированных (по умолчанию true) */
  @IsOptional()
  @IsBoolean()
  onlyActive?: boolean;
}
