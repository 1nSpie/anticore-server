// Единый вход: администратор из env, сотрудник-админ или мастер.
// Формат логина и пароля проверяется при создании учётки, при входе — только непустота и разумные пределы
// (иначе логин мастера с точкой или длиннее 50 символов не прошёл бы валидацию формы).
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Логин обязателен' })
  @MaxLength(64, { message: 'Логин не длиннее 64 символов' })
  login: string;

  @IsString()
  @IsNotEmpty({ message: 'Пароль обязателен' })
  @MaxLength(128, { message: 'Пароль не длиннее 128 символов' })
  password: string;
}
