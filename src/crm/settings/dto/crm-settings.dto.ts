import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CRM_LOCATIONS } from "../../common/crm-location";

export class UpdateSmsTemplatesDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsString()
  @MaxLength(2000)
  appointment!: string;

  @IsString()
  @MaxLength(2000)
  review!: string;

  @IsString()
  @MaxLength(2000)
  birthday!: string;
}

export class ServiceTypeItemDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  active?: boolean;
}

export class UpdateServiceTypesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceTypeItemDto)
  items!: ServiceTypeItemDto[];
}

export class DayLimitItemDto {
  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  maxAppointments!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}

export class UpsertDayLimitsDto {
  @IsIn([...CRM_LOCATIONS])
  location!: (typeof CRM_LOCATIONS)[number];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayLimitItemDto)
  items!: DayLimitItemDto[];
}
