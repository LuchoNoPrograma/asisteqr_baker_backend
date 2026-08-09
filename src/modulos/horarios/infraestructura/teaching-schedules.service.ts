import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EstadoDocente, Prisma } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { SaveTeachingScheduleDto } from "../aplicacion/dto/save-teaching-schedule.dto";

type TeachingScheduleWithRelations = Prisma.HorarioClaseGetPayload<{
  include: { docente: true; curso: true };
}>;

@Injectable()
export class TeachingSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(docenteId?: string, cursoId?: string) {
    const schedules = await this.prisma.horarioClase.findMany({
      where: {
        activo: true,
        docente: { estado: EstadoDocente.ACTIVO },
        curso: { activo: true },
        ...(docenteId ? { docenteId } : {}),
        ...(cursoId ? { cursoId } : {}),
      },
      include: { docente: true, curso: true },
      orderBy: [
        { diaSemana: "asc" },
        { horaInicio: "asc" },
        { curso: { nombre: "asc" } },
      ],
      take: 500,
    });
    return schedules.map((schedule) => this.toResponse(schedule));
  }

  async create(dto: SaveTeachingScheduleDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const data = await this.validate(tx, dto);
      const schedule = await tx.horarioClase.create({
        data: { ...data, creadoPor: actor.sub },
        include: { docente: true, curso: true },
      });
      await Promise.all([
        tx.docenteCurso.upsert({
          where: {
            docenteId_cursoId: {
              docenteId: dto.docenteId,
              cursoId: dto.cursoId,
            },
          },
          update: {},
          create: { docenteId: dto.docenteId, cursoId: dto.cursoId },
        }),
        this.audit(tx, actor, "HORARIO_CLASE_CREADO", schedule.id),
      ]);
      return this.toResponse(schedule);
    });
  }

  async update(
    id: string,
    dto: SaveTeachingScheduleDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.horarioClase.findUnique({ where: { id } });
      if (!current || !current.activo)
        throw new NotFoundException("Horario de clase no encontrado");
      const data = await this.validate(tx, dto, id);
      const schedule = await tx.horarioClase.update({
        where: { id },
        data,
        include: { docente: true, curso: true },
      });
      await Promise.all([
        tx.docenteCurso.upsert({
          where: {
            docenteId_cursoId: {
              docenteId: dto.docenteId,
              cursoId: dto.cursoId,
            },
          },
          update: {},
          create: { docenteId: dto.docenteId, cursoId: dto.cursoId },
        }),
        this.audit(tx, actor, "HORARIO_CLASE_ACTUALIZADO", id),
      ]);
      return this.toResponse(schedule);
    });
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.horarioClase.updateMany({
        where: { id, activo: true },
        data: { activo: false },
      });
      if (!result.count)
        throw new NotFoundException("Horario de clase no encontrado");
      await this.audit(tx, actor, "HORARIO_CLASE_INACTIVADO", id);
    });
  }

  private async validate(
    tx: Prisma.TransactionClient,
    dto: SaveTeachingScheduleDto,
    currentId?: string,
  ) {
    const materia = dto.materia.trim();
    const horaInicio = this.parseTime(dto.horaInicio);
    const horaFin = this.parseTime(dto.horaFin);
    if (horaFin <= horaInicio)
      throw new BadRequestException(
        "La hora de fin debe ser posterior a la hora de inicio",
      );

    const [teacher, course] = await Promise.all([
      tx.docente.findFirst({
        where: { id: dto.docenteId, estado: EstadoDocente.ACTIVO },
        select: { id: true },
      }),
      tx.curso.findFirst({
        where: { id: dto.cursoId, activo: true },
        select: { id: true },
      }),
    ]);
    if (!teacher) throw new NotFoundException("Docente activo no encontrado");
    if (!course) throw new NotFoundException("Curso activo no encontrado");

    const conflict = await tx.horarioClase.findFirst({
      where: {
        activo: true,
        diaSemana: dto.diaSemana,
        ...(currentId ? { id: { not: currentId } } : {}),
        OR: [{ docenteId: dto.docenteId }, { cursoId: dto.cursoId }],
        horaInicio: { lt: horaFin },
        horaFin: { gt: horaInicio },
      },
      select: { id: true },
    });
    if (conflict)
      throw new ConflictException(
        "El docente o el curso ya tiene una clase en ese horario",
      );

    return {
      docenteId: dto.docenteId,
      cursoId: dto.cursoId,
      materia,
      diaSemana: dto.diaSemana,
      horaInicio,
      horaFin,
      activo: true,
    };
  }

  private parseTime(value: string): Date {
    return new Date(`1970-01-01T${value}:00.000Z`);
  }

  private formatTime(value: Date): string {
    return value.toISOString().slice(11, 16);
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    action: string,
    resourceId: string,
  ) {
    return tx.auditoria.create({
      data: {
        usuarioId: actor.sub,
        accion: action,
        recurso: "horarios_clase",
        recursoId: resourceId,
      },
    });
  }

  private toResponse(schedule: TeachingScheduleWithRelations) {
    return {
      id: schedule.id,
      materia: schedule.materia,
      diaSemana: schedule.diaSemana,
      horaInicio: this.formatTime(schedule.horaInicio),
      horaFin: this.formatTime(schedule.horaFin),
      activo: schedule.activo,
      docente: {
        id: schedule.docente.id,
        codigo: schedule.docente.codigoDocente,
        nombreCompleto: `${schedule.docente.nombres} ${schedule.docente.apellidos}`,
        especialidad: schedule.docente.especialidad,
        telefono: schedule.docente.telefono,
      },
      curso: {
        id: schedule.curso.id,
        nombre: schedule.curso.nombre,
      },
    };
  }
}
