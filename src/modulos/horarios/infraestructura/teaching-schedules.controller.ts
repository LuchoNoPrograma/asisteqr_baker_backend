import { Body, Controller, Get, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CurrentUser } from "../../../comun/seguridad/current-user.decorator";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { SessionAuthGuard } from "../../autenticacion/infraestructura/session-auth.guard";
import { SaveGeneralScheduleConfigDto } from "../aplicacion/dto/save-general-schedule-config.dto";
import { SaveSchedulePlannerDto } from "../aplicacion/dto/save-schedule-planner.dto";
import { TeachingSchedulesService } from "./teaching-schedules.service";

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller("horarios-clase")
export class TeachingSchedulesController {
  constructor(private readonly service: TeachingSchedulesService) {}

  @Get()
  list(
    @Query("docenteId") docenteId?: string,
    @Query("cursoId") cursoId?: string,
  ) {
    return this.service.list(docenteId, cursoId);
  }

  @Get("planificador")
  planner(@Query("periodoId") periodoId?: string) {
    return this.service.loadPlanner(periodoId);
  }

  @Put("planificador")
  @Roles("ADMINISTRADOR")
  savePlanner(
    @Body() dto: SaveSchedulePlannerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.savePlanner(dto, user);
  }

  @Put("configuracion/general")
  @Roles("ADMINISTRADOR")
  saveGeneralConfig(
    @Body() dto: SaveGeneralScheduleConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveGeneralConfig(dto, user);
  }
}
