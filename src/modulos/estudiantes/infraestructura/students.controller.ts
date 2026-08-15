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
import { CurrentUser } from "../../../comun/seguridad/current-user.decorator";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { SessionAuthGuard } from "../../autenticacion/infraestructura/session-auth.guard";
import { CreateStudentDto } from "../aplicacion/dto/create-student.dto";
import { UpdateStudentDto } from "../aplicacion/dto/update-student.dto";
import { StudentsService } from "./students.service";

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller("estudiantes")
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

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
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Roles("ADMINISTRADOR")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateStudentDto,
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
