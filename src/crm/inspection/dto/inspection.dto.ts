import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { DAMAGE_TYPES } from "../inspection.rules";


export class UpdateInspectionDto {
  @IsOptional() @IsDateString() receivedAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() receivedById?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() mileageKm?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() fuelPercent?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() keysCount?: number | null;
  @IsOptional() @IsBoolean() noDefectsConfirmed?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) exteriorNote?: string | null;
  @IsOptional() @IsObject() interior?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(2000) interiorNote?: string | null;
  @IsOptional() @IsObject() systems?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(2000) systemsNote?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) specialTerms?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) note?: string | null;
}

export class CreateMarkDto {
  @IsIn([...DAMAGE_TYPES]) type!: (typeof DAMAGE_TYPES)[number];
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) x!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) y!: number;
  @IsString() @MaxLength(100) element!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}

export class UpdateMarkDto {
  @IsOptional() @IsIn([...DAMAGE_TYPES]) type?: (typeof DAMAGE_TYPES)[number];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) x?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) y?: number;
  @IsOptional() @IsString() @MaxLength(100) element?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}
