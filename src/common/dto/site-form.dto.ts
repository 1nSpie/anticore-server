import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { IsPhoneRu } from "../phone.validator";

/** Заявка с сайта: обратный звонок */
export class SiteCallbackDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsPhoneRu()
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  href?: string;
}

/** Заявка с сайта: расчёт цены / полная форма */
export class SitePriceRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsPhoneRu()
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customBrand?: string;

  @IsOptional()
  isNotAuto?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  carDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  href?: string;

  @IsOptional()
  @IsIn(["telegram", "whatsapp", "phone"])
  contactMethod?: string;

  @IsOptional()
  @IsIn(["telegram", "whatsapp", "phone"])
  communicationMethod?: string;
}
