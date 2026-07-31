import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { CRM_LOCATIONS } from "../../common/crm-location";

export class CreateAppointmentDto {
  @IsInt()
  @Min(1)
  clientId!: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsString()
  @MaxLength(300)
  serviceType!: string;

  @IsOptional()
  @IsInt()
  serviceTypeId?: number;

  @IsInt()
  @Min(0)
  priceRub!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  managerName?: string;

  @IsOptional()
  @IsIn([...CRM_LOCATIONS])
  location?: (typeof CRM_LOCATIONS)[number];

  /** Если указан — запись создаётся вместе с привязкой заявки (защита от дублей). */
  @IsOptional()
  @IsInt()
  @Min(1)
  leadId?: number;
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  serviceType?: string;

  @IsOptional()
  @IsInt()
  serviceTypeId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceRub?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  managerName?: string | null;

  @IsOptional()
  @IsIn([...CRM_LOCATIONS])
  location?: (typeof CRM_LOCATIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diskLink?: string | null;
}
