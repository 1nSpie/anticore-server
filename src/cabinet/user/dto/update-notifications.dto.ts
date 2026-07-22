import { IsBoolean, IsOptional } from "class-validator";

export class UpdateNotificationsDto {
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyReminder?: boolean;
}
