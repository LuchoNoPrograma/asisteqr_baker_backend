import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CurrentUser } from "../../../comun/seguridad/current-user.decorator";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { JwtAuthGuard } from "../../autenticacion/infraestructura/jwt-auth.guard";
import { ScanQrDto } from "../aplicacion/dto/scan-qr.dto";
import { AttendanceService } from "./attendance.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller("asistencias")
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post("escanear")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  scan(
    @Body() dto: ScanQrDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.scan(dto.tokenQr, user, ip);
  }

  @Get("diaria")
  daily(@Query("fecha") fecha?: string, @Query("cursoId") cursoId?: string) {
    return this.service.daily(fecha, cursoId);
  }
}
