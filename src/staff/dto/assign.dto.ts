import { ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsInt, IsOptional, Min } from "class-validator";

/** Полный список мастеров записи: кого нет в списке — снимается с записи. */
export class SetAssigneesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  staffIds!: number[];
}

export class ScheduleQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
