import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CrmLocation, StockMoveKind } from "../../../../generated/prisma/client";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() || undefined : value);
const QTY = { maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false };

export class CreateStockItemDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(16)
  unit: string;

  @IsOptional() @IsNumber(QTY) @Min(0) @Max(1_000_000)
  minQty?: number;
}

export class UpdateStockItemDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(16)
  unit?: string;

  @IsOptional() @IsNumber(QTY) @Min(0) @Max(1_000_000)
  minQty?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class CreateStockMovementDto {
  @IsInt()
  itemId: number;

  @IsEnum(CrmLocation)
  location: CrmLocation;

  /** IN — приход, OUT — расход, ADJUST — инвентаризация (qty — новый фактический остаток) */
  @IsEnum(StockMoveKind)
  kind: StockMoveKind;

  @IsNumber(QTY) @Min(0) @Max(1_000_000)
  qty: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  comment?: string;

  /** Расход на запись (материалы под конкретный заказ) */
  @IsOptional() @IsInt()
  visitId?: number;
}

export class StockQueryDto {
  @IsOptional() @IsEnum(CrmLocation)
  location?: CrmLocation;
}

export class MovementsQueryDto extends StockQueryDto {
  @IsOptional() @Type(() => Number) @IsInt()
  itemId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  visitId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;
}
