import {
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
  IsInt,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  patronymic?: string;

  /** ISO date YYYY-MM-DD */
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  /**
   * ID автомобиля из каталога (`Car`).
   * `null` — убрать привязку; поле не передавать, если менять не нужно.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Type(() => Number)
  carId?: number | null;

  /** Автомобиль в свободной форме, если нет в каталоге. `null` — очистить. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200)
  customCar?: string | null;
}
