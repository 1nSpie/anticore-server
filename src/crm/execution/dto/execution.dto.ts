import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { ApprovalChannel } from "../../../../generated/prisma/client";

const WORK_STATUSES = ["WAITING", "IN_PROGRESS", "DONE", "PAUSED", "NEEDS_APPROVAL", "CANCELLED"] as const;

export class UpdateExecutionDto {
  @IsOptional() @IsIn([...WORK_STATUSES]) status?: (typeof WORK_STATUSES)[number];
  @IsOptional() @Type(() => Number) @IsInt() masterId?: number | null;
  @IsOptional() @IsString() @MaxLength(300) actualVolume?: string | null;
  /** Комментарий по выполнению; для отмены — причина. */
  @IsOptional() @IsString() @MaxLength(500) workNote?: string | null;
}

export class CreateExtraDto {
  @Type(() => Number) @IsInt() categoryId!: number;
  @IsObject() selections!: Record<string, unknown>;
  /** Описание обнаруженного дефекта. */
  @IsString() @MinLength(3, { message: "Опишите обнаруженный дефект" }) @MaxLength(500) comment!: string;
  @IsOptional() @IsString() @MaxLength(200) defectPlace?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceRub?: number | null;
  @IsOptional() @IsString() @MaxLength(200) termChangeNote?: string | null;
}

export class UpdateExtraDto {
  @IsOptional() @IsObject() selections?: Record<string, unknown>;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(500) comment?: string;
  @IsOptional() @IsString() @MaxLength(200) defectPlace?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceRub?: number | null;
  @IsOptional() @IsString() @MaxLength(200) termChangeNote?: string | null;
}

export class DecideExtraDto {
  @IsIn(["APPROVED", "REJECTED"]) decision!: "APPROVED" | "REJECTED";
  @IsEnum(ApprovalChannel) channel!: ApprovalChannel;
  /** Когда клиент дал ответ; по умолчанию — сейчас. */
  @IsOptional() @IsDateString() approvedAt?: string;
  /** Кто из сотрудников получил ответ; по умолчанию — текущий пользователь. */
  @IsOptional() @IsString() @MaxLength(120) approvedBy?: string;
  /** Подтверждение: например, «сообщение в WhatsApp, 22.11 14:05». */
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class WorkPhotoDto {
  @IsIn(["WORK_BEFORE", "WORK_AFTER"]) stage!: "WORK_BEFORE" | "WORK_AFTER";
}

export class UpdateHandoverDto {
  @IsOptional() @IsDateString() issuedAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() issuedById?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() mileageKm?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() fuelPercent?: number | null;
  @IsOptional() @IsBoolean() warrantyBookIssued?: boolean | null;
  @IsOptional() @IsBoolean() warrantyTermsExplained?: boolean | null;
  @IsOptional() @Type(() => Number) @IsInt() warrantyMonths?: number | null;
  @IsOptional() @IsDateString() warrantyStartsAt?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) warrantyTerms?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) careRecommendations?: string | null;
}
