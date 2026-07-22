import { IsString, MinLength } from "class-validator";
import { IsPhoneRu } from "../../../common/phone.validator";

export class VerifyRegistrationDto {
  @IsString()
  @IsPhoneRu()
  phone!: string;

  @IsString()
  @MinLength(4)
  code!: string;
}
