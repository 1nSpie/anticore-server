import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from "class-validator";
import { CrmLocation } from "../../../generated/prisma/client";

export class CheckinDto {
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @IsNumber()
  @IsLongitude()
  lng!: number;

  /** Точность GPS, метры — для разбора спорных чекинов. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  accuracyM?: number;

  /** Филиал можно указать вручную; иначе — ближайший из филиалов мастера. */
  @IsOptional()
  @IsEnum(CrmLocation)
  location?: CrmLocation;
}

export class CheckinListQueryDto {
  /** YYYY-MM-DD, по умолчанию сегодня (МСК). */
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(CrmLocation)
  location?: CrmLocation;
}

export class DecideCheckinDto {
  @Transform(({ value }) => value)
  @IsIn(["CONFIRMED", "REJECTED"])
  status!: "CONFIRMED" | "REJECTED";
}
