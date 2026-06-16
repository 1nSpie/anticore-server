import { IsString, Length, Matches } from "class-validator";

export class VerifyRegistrationDto {
  @IsString()
  @Matches(/^[\d\s+()-]+$/)
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;
}
