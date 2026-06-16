import { IsString, MinLength, Matches } from "class-validator";

export class CabinetLoginDto {
  @IsString()
  @Matches(/^[\d\s+()-]+$/)
  phone!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
