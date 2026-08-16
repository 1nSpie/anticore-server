import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";
import { IsVin } from "../../common/vin.validator";

export class UpsertClientVehicleDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  carId?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200)
  customLabel?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(17)
  @IsVin()
  vin?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
