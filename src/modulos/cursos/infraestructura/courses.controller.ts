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
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CurrentUser } from "../../../comun/seguridad/current-user.decorator";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { positiveIntegerIdPipe } from "../../../comun/validacion/integer-id-pipes";
import { SessionAuthGuard } from "../../autenticacion/infraestructura/session-auth.guard";
import { CreateCourseDto } from "../aplicacion/dto/create-course.dto";
import { SaveScheduleDto } from "../aplicacion/dto/save-schedule.dto";
import { UpdateCourseDto } from "../aplicacion/dto/update-course.dto";
import { CoursesService } from "./courses.service";

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE", "REGENTE")
@Controller("cursos")
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  @Get()
  list(@Query("buscar") buscar?: string) {
    return this.service.list(buscar);
  }

  @Get(":id")
  get(@Param("id", positiveIntegerIdPipe) id: number) {
    return this.service.get(id);
  }

  @Get(":id/horarios")
  schedules(@Param("id", positiveIntegerIdPipe) id: number) {
    return this.service.get(id).then((course) => course.horarios);
  }

  @Post()
  @Roles("ADMINISTRADOR")
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Roles("ADMINISTRADOR")
  update(
    @Param("id", positiveIntegerIdPipe) id: number,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("id", positiveIntegerIdPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user);
  }

  @Post(":id/horarios")
  @Roles("ADMINISTRADOR")
  createSchedule(
    @Param("id", positiveIntegerIdPipe) id: number,
    @Body() dto: SaveScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createSchedule(id, dto, user);
  }

  @Patch(":id/horarios/:scheduleId")
  @Roles("ADMINISTRADOR")
  updateSchedule(
    @Param("id", positiveIntegerIdPipe) id: number,
    @Param("scheduleId", positiveIntegerIdPipe) scheduleId: number,
    @Body() dto: SaveScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateSchedule(id, scheduleId, dto, user);
  }

  @Delete(":id/horarios/:scheduleId")
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSchedule(
    @Param("id", positiveIntegerIdPipe) id: number,
    @Param("scheduleId", positiveIntegerIdPipe) scheduleId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeSchedule(id, scheduleId, user);
  }
}
