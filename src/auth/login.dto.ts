// src/admin/dto/login.dto.ts
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Логин обязателен' })
  @Length(3, 50, { message: 'Логин должен быть от 3 до 50 символов' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Логин может содержать только буквы, цифры, дефисы и подчеркивания',
  })
  login: string;

  @IsString()
  @IsNotEmpty({ message: 'Пароль обязателен' })
  @Length(5, 100, { message: 'Пароль должен быть от 5 до 100 символов' })
  password: string;
}