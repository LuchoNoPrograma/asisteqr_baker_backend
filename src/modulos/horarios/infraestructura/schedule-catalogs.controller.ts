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
  UseGuards,
} from "@nestjs/common";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CurrentUser } from "../../../comun/seguridad/current-user.decorator";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { JwtAuthGuard } from "../../autenticacion/infraestructura/jwt-auth.guard";
import {
  SaveClassroomDto,
  SaveSubjectDto,
} from "../aplicacion/dto/save-schedule-catalog.dto";
import { ScheduleCatalogsService } from "./schedule-catalogs.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller()
export class ScheduleCatalogsController {
  constructor(private readonly service: ScheduleCatalogsService) {}

  @Get("materias")
  listSubjects() {
    return this.service.listSubjects();
  }

  @Post("materias")
  @Roles("ADMINISTRADOR")
  createSubject(
    @Body() dto: SaveSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveSubject(dto, user);
  }

  @Patch("materias/:id")
  @Roles("ADMINISTRADOR")
  updateSubject(
    @Param("id") id: string,
    @Body() dto: SaveSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveSubject(dto, user, id);
  }

  @Delete("materias/:id")
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateSubject(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deactivateSubject(id, user);
  }

  @Get("aulas")
  listClassrooms() {
    return this.service.listClassrooms();
  }

  @Post("aulas")
  @Roles("ADMINISTRADOR")
  createClassroom(
    @Body() dto: SaveClassroomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveClassroom(dto, user);
  }

  @Patch("aulas/:id")
  @Roles("ADMINISTRADOR")
  updateClassroom(
    @Param("id") id: string,
    @Body() dto: SaveClassroomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveClassroom(dto, user, id);
  }

  @Delete("aulas/:id")
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateClassroom(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deactivateClassroom(id, user);
  }
}
