import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { CrmLocation, StaffRole } from "../../../generated/prisma/client";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class StaffLoginDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  login: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class CreateStaffDto {
  @Transform(trim)
  @Matches(/^[A-Za-z0-9._-]{3,64}$/, { message: "Логин: 3–64 символа, латиница, цифры и . _ -" })
  login: string;

  @IsString()
  @MinLength(8, { message: "Пароль не короче 8 символов" })
  @MaxLength(128)
  password: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;

  @IsArray()
  @ArrayUnique()
  @IsEnum(CrmLocation, { each: true })
  locations: CrmLocation[];
}

export class UpdateStaffDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(CrmLocation, { each: true })
  locations?: CrmLocation[];
}

export class ResetStaffPasswordDto {
  /** Если не задан, сервер генерирует пароль и возвращает его один раз. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

export class StaffAuditQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  staffId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(0)
  offset?: number;
}
