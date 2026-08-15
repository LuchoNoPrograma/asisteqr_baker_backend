import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { SessionAuthGuard } from "../../autenticacion/infraestructura/session-auth.guard";
import { PeriodsService } from "./periods.service";

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller("periodos")
export class PeriodsController {
  constructor(private readonly service: PeriodsService) {}

  @Get("activo")
  active() {
    return this.service.active();
  }
}
