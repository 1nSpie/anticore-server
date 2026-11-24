import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { CashDirection, CrmLocation } from "../../../../generated/prisma/client";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() || undefined : value);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCashEntryDto {
  @IsEnum(CrmLocation)
  location: CrmLocation;

  @IsEnum(CashDirection)
  direction: CashDirection;

  @IsInt() @Min(1) @Max(100_000_000)
  amountRub: number;

  /** Дата операции (по Москве); по умолчанию сегодня */
  @IsOptional() @Matches(YMD, { message: "Дата: ГГГГ-ММ-ДД" })
  date?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(60)
  category?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  comment?: string;

  /** Запись, к которой относится операция (например, оплата клиента) */
  @IsOptional() @IsInt()
  visitId?: number;
}

export class VoidCashEntryDto {
  @Transform(trim) @IsString() @MinLength(3, { message: "Укажите причину" }) @MaxLength(300)
  reason: string;
}

export class CashQueryDto {
  @Matches(YMD, { message: "Дата: ГГГГ-ММ-ДД" })
  from: string;

  @Matches(YMD, { message: "Дата: ГГГГ-ММ-ДД" })
  to: string;

  @IsOptional() @IsEnum(CrmLocation)
  location?: CrmLocation;

  @IsOptional() @Type(() => Boolean)
  csv?: boolean;
}
