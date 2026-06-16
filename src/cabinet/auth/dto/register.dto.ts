import { IsBoolean, IsString, MinLength, Matches, Equals } from "class-validator";

export class RegisterDto {
  @IsString()
  @Matches(/^[\d\s+()-]+$/, {
    message: "Телефон может содержать только цифры и символы форматирования",
  })
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
}
