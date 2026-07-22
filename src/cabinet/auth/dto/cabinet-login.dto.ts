import { IsString, MinLength } from "class-validator";
import { IsPhoneRu } from "../../../common/phone.validator";

export class CabinetLoginDto {
  @IsString()
  @IsPhoneRu()
  phone!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
