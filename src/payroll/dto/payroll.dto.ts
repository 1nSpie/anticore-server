import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { CrmLocation, PayrollRole } from "../../../generated/prisma/client";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const MAX_RUB = 10_000_000;

export class UpdatePayrollSettingsDto {
  @IsInt() @Min(0) @Max(MAX_RUB)
  masterBaseRub: number;

  @IsInt() @Min(0) @Max(MAX_RUB)
  receiverBaseRub: number;
}

export class CreateBonusTypeDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  title: string;

  @IsInt() @Min(0) @Max(MAX_RUB)
  amountRub: number;

  @IsEnum(PayrollRole)
  role: PayrollRole;
}

export class UpdateBonusTypeDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  title?: string;

  @IsOptional() @IsInt() @Min(0) @Max(MAX_RUB)
  amountRub?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class SetReceiverDto {
  /** null — снять приёмщика */
  @IsOptional() @IsInt()
  staffId?: number | null;
}

export class SetBonusDto {
  @IsInt()
  typeId: number;

  @IsBoolean()
  granted: boolean;
}

export class PayrollReportQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Дата: ГГГГ-ММ-ДД" })
  from: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Дата: ГГГГ-ММ-ДД" })
  to: string;

  @IsOptional() @Type(() => Number) @IsInt()
  staffId?: number;

  @IsOptional() @IsEnum(CrmLocation)
  location?: CrmLocation;
}
