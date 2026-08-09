import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { JwtAuthGuard } from "../../autenticacion/infraestructura/jwt-auth.guard";
import { PeriodsService } from "./periods.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller("periodos")
export class PeriodsController {
  constructor(private readonly service: PeriodsService) {}

  @Get("activo")
  active() {
    return this.service.active();
  }
}
