import { IsString, Length, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[\d\s+()-]+$/)
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  passwordConfirm!: string;
}
