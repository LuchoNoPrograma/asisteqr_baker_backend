import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CurrentUser } from "../../../comun/seguridad/current-user.decorator";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { positiveIntegerIdPipe } from "../../../comun/validacion/integer-id-pipes";
import { SessionAuthGuard } from "../../autenticacion/infraestructura/session-auth.guard";
import { CreateNonInstructionalDayDto } from "../aplicacion/dto/create-non-instructional-day.dto";
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

  @Get(":id/dias-no-lectivos")
  nonInstructionalDays(@Param("id", positiveIntegerIdPipe) id: number) {
    return this.service.nonInstructionalDays(id);
  }

  @Post(":id/dias-no-lectivos")
  @Roles("ADMINISTRADOR")
  createNonInstructionalDay(
    @Param("id", positiveIntegerIdPipe) id: number,
    @Body() dto: CreateNonInstructionalDayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createNonInstructionalDay(id, dto, user);
  }

  @Delete(":id/dias-no-lectivos/:dayId")
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeNonInstructionalDay(
    @Param("id", positiveIntegerIdPipe) id: number,
    @Param("dayId", positiveIntegerIdPipe) dayId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeNonInstructionalDay(id, dayId, user);
  }
}
