import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethod } from "../../../../generated/prisma/client";

export class CreateWorkItemDto {
  @Type(() => Number) @IsInt() categoryId!: number;
  @IsObject() selections!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(500) comment?: string | null;
  /** null — стоимость не определена; 0 — бесплатно. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceRub?: number | null;
  /** Как согласовано изменение — обязательно, если договор уже подписан. */
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class UpdateWorkItemDto {
  @IsOptional() @IsObject() selections?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(500) comment?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceRub?: number | null;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class DeleteWorkItemQueryDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class UpdatePricingDto {
  @IsOptional() @Type(() => Number) @IsNumber() discountPercent?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() discountRub?: number | null;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) paidRub?: number | null;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class AddOptionDto {
  @IsString() @MaxLength(100) name!: string;
}

export class UpdateOptionDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
