import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../../comun/seguridad/current-user.decorator";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { LoginDto } from "../aplicacion/dto/login.dto";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./session-auth.guard";

@Controller("autenticacion")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post("iniciar-sesion")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.service.login(dto, ip);
  }

  @Get("sesion")
  @UseGuards(SessionAuthGuard)
  session(@CurrentUser() user: AuthenticatedUser) {
    return this.service.current(user);
  }

  @Post("cerrar-sesion")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.service.logout(user);
  }
}
