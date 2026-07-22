import { IsString } from "class-validator";
import { IsPhoneRu } from "../../../common/phone.validator";

export class ForgotPasswordDto {
  @IsString()
  @IsPhoneRu()
  phone!: string;

  /** Токен Yandex SmartCaptcha */
  @IsString()
  captchaToken!: string;
}
