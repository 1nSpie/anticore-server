import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class FormDocumentDto {
  /** Исправленная версия поверх уже подписанной (подписанная остаётся без изменений). */
  @IsOptional() @IsBoolean() correction?: boolean;
}

export class VoidVersionDto {
  @IsString() @MinLength(3, { message: "Укажите причину аннулирования" }) @MaxLength(300) reason!: string;
}
