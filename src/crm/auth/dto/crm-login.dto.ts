import { IsString, MinLength } from "class-validator";
import { IsPhoneRu } from "../../../common/phone.validator";

export class CrmLoginDto {
  @IsString()
  @IsPhoneRu()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
