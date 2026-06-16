import { IsString, Matches } from "class-validator";

export class ForgotPasswordDto {
  @IsString()
  @Matches(/^[\d\s+()-]+$/)
  phone!: string;
}
