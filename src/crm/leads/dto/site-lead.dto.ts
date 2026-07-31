import {
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
import { IsPhoneRu } from "../../../common/phone.validator";
import { CRM_LOCATIONS } from "../../common/crm-location";

const SITE_LEAD_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "NEEDS_CLARIFICATION",
  "SCHEDULED",
  "REJECTED",
  "COMPLETED",
] as const;

const SITE_LEAD_KINDS = ["CALLBACK", "PRICE_REQUEST"] as const;

const COMMUNICATION_METHODS = ["telegram", "whatsapp", "phone"] as const;

export class UpdateSiteLeadDto {
  @IsOptional()
  @IsIn([...SITE_LEAD_STATUSES])
  status?: (typeof SITE_LEAD_STATUSES)[number];

  @IsOptional()
  @IsIn([...SITE_LEAD_KINDS])
  kind?: (typeof SITE_LEAD_KINDS)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsPhoneRu()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  carDescription?: string | null;

  @IsOptional()
  @IsIn([...COMMUNICATION_METHODS])
  communicationMethod?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNote?: string | null;

  @IsOptional()
  @IsDateString()
  followUpAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn([...CRM_LOCATIONS])
  location?: (typeof CRM_LOCATIONS)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  diskLink?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  visitId?: number | null;
}

export class ScheduleLeadDto {
  @IsInt()
  @Type(() => Number)
  visitId!: number;
}
