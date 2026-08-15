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
import { SessionAuthGuard } from "../../autenticacion/infraestructura/session-auth.guard";
import { CreateTeacherDto } from "../aplicacion/dto/create-teacher.dto";
import { UpdateTeacherDto } from "../aplicacion/dto/update-teacher.dto";
import { TeachersService } from "./teachers.service";

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller("docentes")
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  @Get()
  list(@Query("buscar") buscar?: string, @Query("cursoId") cursoId?: string) {
    return this.service.list(buscar, cursoId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @Roles("ADMINISTRADOR")
  create(
    @Body() dto: CreateTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Roles("ADMINISTRADOR")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTeacherDto,
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
