import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  brandName?: string;

  @IsOptional()
  @Matches(/^(\d{10}|\d{12})$/, { message: "ИНН: 10 или 12 цифр" })
  inn?: string;

  @IsOptional()
  @Matches(/^(\d{13}|\d{15})$/, { message: "ОГРН/ОГРНИП: 13 или 15 цифр" })
  ogrnip?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  legalAddress?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  signerName?: string;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @Matches(/^[A-Za-zА-Яа-яЁё]{1,4}$/, { message: "Префикс: 1–4 буквы" })
  docPrefix?: string;
}
