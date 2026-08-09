import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CurrentUser } from "../../../comun/seguridad/current-user.decorator";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { JwtAuthGuard } from "../../autenticacion/infraestructura/jwt-auth.guard";
import { SaveTeachingScheduleDto } from "../aplicacion/dto/save-teaching-schedule.dto";
import { SaveGeneralScheduleConfigDto } from "../aplicacion/dto/save-general-schedule-config.dto";
import { SaveSchedulePlannerDto } from "../aplicacion/dto/save-schedule-planner.dto";
import { SaveTeacherScheduleMatrixDto } from "../aplicacion/dto/save-teacher-schedule-matrix.dto";
import { TeachingSchedulesService } from "./teaching-schedules.service";

@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get("docente/:docenteId/editor")
  editor(
    @Param("docenteId") docenteId: string,
    @Query("periodoId") periodoId?: string,
  ) {
    return this.service.loadEditor(docenteId, periodoId);
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

  @Put("docente/:docenteId/editor")
  @Roles("ADMINISTRADOR")
  saveMatrix(
    @Param("docenteId") docenteId: string,
    @Body() dto: SaveTeacherScheduleMatrixDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveMatrix(docenteId, dto, user);
  }

  @Put("configuracion/general")
  @Roles("ADMINISTRADOR")
  saveGeneralConfig(
    @Body() dto: SaveGeneralScheduleConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveGeneralConfig(dto, user);
  }

  @Post()
  @Roles("ADMINISTRADOR")
  create(
    @Body() dto: SaveTeachingScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Roles("ADMINISTRADOR")
  update(
    @Param("id") id: string,
    @Body() dto: SaveTeachingScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
}
