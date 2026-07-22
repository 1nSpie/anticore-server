import { IsString, MinLength } from "class-validator";
import { IsPhoneRu } from "../../../common/phone.validator";

export class ResetPasswordDto {
  @IsString()
  @IsPhoneRu()
  phone!: string;

  @IsString()
  @MinLength(4)
  code!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  passwordConfirm!: string;
}
