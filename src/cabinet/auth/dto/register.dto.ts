import { IsBoolean, IsString, MinLength, Equals } from "class-validator";
import { IsPhoneRu } from "../../../common/phone.validator";

export class RegisterDto {
  @IsString()
  @IsPhoneRu()
  phone!: string;

  @IsString()
  @MinLength(8, { message: "Пароль не короче 8 символов" })
  password!: string;

  @IsString()
  @MinLength(8, { message: "Подтверждение пароля не короче 8 символов" })
  passwordConfirm!: string;

  @IsBoolean()
  @Equals(true, {
    message: "Необходимо ознакомиться с Политикой конфиденциальности",
  })
  acceptPrivacyPolicy!: boolean;

  @IsBoolean()
  @Equals(true, {
    message: "Необходимо дать согласие на обработку персональных данных",
  })
  acceptPersonalDataConsent!: boolean;

  @IsBoolean()
  @Equals(true, {
    message: "Необходимо принять Пользовательское соглашение",
  })
  acceptTerms!: boolean;

  /** Токен Yandex SmartCaptcha */
  @IsString()
  captchaToken!: string;
}
