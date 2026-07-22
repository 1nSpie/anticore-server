import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";
import { IsVin } from "../../../common/vin.validator";
import { IsPhoneRu } from "../../../common/phone.validator";

export class CreateCrmClientDto {
  @IsString()
  @IsPhoneRu()
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  patronymic?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  carId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  @IsVin()
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminComment?: string;
}

export class UpdateCrmClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  patronymic?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  carId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  @IsVin()
  vin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminComment?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200)
  customCar?: string | null;

  @IsOptional()
  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyReminder?: boolean;
}

const CLIENT_FILTERS = ["all", "lk", "no_lk", "blocked", "has_visits"] as const;

export class ListCrmClientsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...CLIENT_FILTERS])
  filter?: (typeof CLIENT_FILTERS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

export class CrmBroadcastSmsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsInt()
  userId?: number;
}
