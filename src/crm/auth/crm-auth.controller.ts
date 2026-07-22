import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { CrmAuthService } from "./crm-auth.service";
import { CrmLoginDto } from "./dto/crm-login.dto";
import { CrmJwtGuard } from "./crm-jwt.guard";

@Controller("crm/auth")
export class CrmAuthController {
  constructor(private readonly crmAuth: CrmAuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  login(@Body() dto: CrmLoginDto) {
    return this.crmAuth.login(dto);
  }

  @Get("me")
  @UseGuards(CrmJwtGuard)
  me(@Req() req: Request) {
    const crmAdminId = (req as Request & { crmAdminId?: number }).crmAdminId;
    return { id: crmAdminId, role: "crm_admin" };
  }
}
