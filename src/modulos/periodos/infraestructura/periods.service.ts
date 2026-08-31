import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EstadoPeriodo, Prisma } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { parseCalendarDate } from "../../../comun/validacion/calendar-date";
import { CreateNonInstructionalDayDto } from "../aplicacion/dto/create-non-instructional-day.dto";

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async active() {
    const period = await this.prisma.periodoAcademico.findFirst({
      where: { estado: EstadoPeriodo.ACTIVO },
      orderBy: [{ fechaInicio: "desc" }, { creadoEn: "desc" }],
    });
    if (!period) throw new NotFoundException("No existe un periodo activo");
    return {
      id: period.id,
      nombre: period.nombre,
      gestion: period.gestion,
      fechaInicio: period.fechaInicio.toISOString().slice(0, 10),
      fechaFin: period.fechaFin.toISOString().slice(0, 10),
      estado: period.estado,
    };
  }

  async nonInstructionalDays(periodId: number) {
    await this.requirePeriod(periodId);
    const days = await this.prisma.diaNoLectivo.findMany({
      where: { periodoId: periodId },
      orderBy: { fecha: "asc" },
    });
    return days.map((day) => this.dayResponse(day));
  }

  async createNonInstructionalDay(
    periodId: number,
    dto: CreateNonInstructionalDayDto,
    actor: AuthenticatedUser,
  ) {
    const period = await this.requirePeriod(periodId);
    const date = parseCalendarDate(dto.fecha, "fecha");
    if (date < period.fechaInicio || date > period.fechaFin) {
      throw new BadRequestException(
        "El día no lectivo debe pertenecer al rango del periodo académico",
      );
    }
    if ([0, 6].includes(date.getUTCDay())) {
      throw new BadRequestException(
        "No es necesario registrar sábados o domingos como días no lectivos",
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const day = await tx.diaNoLectivo.create({
          data: {
            periodoId: periodId,
            fecha: date,
            descripcion: dto.descripcion.trim(),
          },
        });
        await tx.auditoria.create({
          data: {
            usuarioId: actor.sub,
            accion: "DIA_NO_LECTIVO_CREADO",
            recurso: "dias_no_lectivos",
            recursoId: day.id,
            metadatos: { periodoId: periodId, fecha: dto.fecha },
          },
        });
        return this.dayResponse(day);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "La fecha ya está registrada como día no lectivo en el periodo",
        );
      }
      throw error;
    }
  }

  async removeNonInstructionalDay(
    periodId: number,
    dayId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const day = await tx.diaNoLectivo.findFirst({
        where: { id: dayId, periodoId: periodId },
        select: { id: true, fecha: true },
      });
      if (!day) throw new NotFoundException("Día no lectivo no encontrado");
      await tx.diaNoLectivo.delete({ where: { id: day.id } });
      await tx.auditoria.create({
        data: {
          usuarioId: actor.sub,
          accion: "DIA_NO_LECTIVO_ELIMINADO",
          recurso: "dias_no_lectivos",
          recursoId: day.id,
          metadatos: {
            periodoId: periodId,
            fecha: day.fecha.toISOString().slice(0, 10),
          },
        },
      });
    });
  }

  private async requirePeriod(id: number) {
    const period = await this.prisma.periodoAcademico.findUnique({
      where: { id },
    });
    if (!period) throw new NotFoundException("Periodo académico no encontrado");
    return period;
  }

  private dayResponse(day: {
    id: number;
    periodoId: number;
    fecha: Date;
    descripcion: string;
  }) {
    return {
      id: day.id,
      periodoId: day.periodoId,
      fecha: day.fecha.toISOString().slice(0, 10),
      descripcion: day.descripcion,
    };
  }
}
