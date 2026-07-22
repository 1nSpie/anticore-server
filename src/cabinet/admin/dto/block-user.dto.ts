import { Transform } from "class-transformer";
import { IsBoolean } from "class-validator";

export class BlockUserDto {
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  blocked!: boolean;
}
