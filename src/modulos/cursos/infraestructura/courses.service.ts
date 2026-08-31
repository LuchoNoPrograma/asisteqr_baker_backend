import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EstadoInscripcion, EstadoPeriodo, Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CreateCourseDto } from "../aplicacion/dto/create-course.dto";
import { SaveScheduleDto } from "../aplicacion/dto/save-schedule.dto";
import { UpdateCourseDto } from "../aplicacion/dto/update-course.dto";

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(buscar?: string) {
    const term = buscar?.trim();
    const courses = await this.prisma.curso.findMany({
      where: {
        activo: true,
        ...(term
          ? {
              OR: [
                { nombre: { contains: term, mode: "insensitive" as const } },
                { nivel: { contains: term, mode: "insensitive" as const } },
                { paralelo: { contains: term, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            inscripciones: { where: { estado: EstadoInscripcion.ACTIVA } },
          },
        },
        asignacionesAcademicas: {
          where: {
            activo: true,
            periodo: { estado: EstadoPeriodo.ACTIVO },
          },
          select: { docenteId: true },
        },
        horarios: { where: { activo: true }, orderBy: { jornada: "asc" } },
      },
      orderBy: [{ gestion: "desc" }, { nivel: "asc" }, { paralelo: "asc" }],
    });
    return courses.map((course) => this.toResponse(course));
  }

  async get(id: number) {
    const course = await this.prisma.curso.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inscripciones: { where: { estado: EstadoInscripcion.ACTIVA } },
          },
        },
        asignacionesAcademicas: {
          where: {
            activo: true,
            periodo: { estado: EstadoPeriodo.ACTIVO },
          },
          select: { docenteId: true },
        },
        horarios: { where: { activo: true }, orderBy: { jornada: "asc" } },
      },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");
    return this.toResponse(course);
  }

  async create(dto: CreateCourseDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const course = await tx.curso.create({
          data: this.courseData(dto),
          include: {
            _count: { select: { inscripciones: true } },
            asignacionesAcademicas: {
              where: {
                activo: true,
                periodo: { estado: EstadoPeriodo.ACTIVO },
              },
              select: { docenteId: true },
            },
            horarios: true,
          },
        });
        await tx.auditoria.create({
          data: {
            usuarioId: actor.sub,
            accion: "CURSO_CREADO",
            recurso: "cursos",
            recursoId: course.id,
          },
        });
        return this.toResponse(course);
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async update(id: number, dto: UpdateCourseDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.curso.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Curso no encontrado");
        await tx.curso.update({
          where: { id },
          data: {
            nombre: this.courseName(
              dto.nivel ?? current.nivel,
              dto.paralelo ?? current.paralelo,
            ),
            ...(dto.nivel !== undefined
              ? { nivel: this.courseLevel(dto.nivel) }
              : {}),
            ...(dto.paralelo !== undefined
              ? { paralelo: dto.paralelo.trim().toUpperCase() }
              : {}),
            ...(dto.gestion !== undefined ? { gestion: dto.gestion } : {}),
          },
        });
        await tx.auditoria.create({
          data: {
            usuarioId: actor.sub,
            accion: "CURSO_ACTUALIZADO",
            recurso: "cursos",
            recursoId: id,
          },
        });
        const updated = await tx.curso.findUniqueOrThrow({
          where: { id },
          include: {
            _count: {
              select: {
                inscripciones: { where: { estado: EstadoInscripcion.ACTIVA } },
              },
            },
            asignacionesAcademicas: {
              where: {
                activo: true,
                periodo: { estado: EstadoPeriodo.ACTIVO },
              },
              select: { docenteId: true },
            },
            horarios: { where: { activo: true }, orderBy: { jornada: "asc" } },
          },
        });
        return this.toResponse(updated);
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const course = await tx.curso.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!course) throw new NotFoundException("Curso no encontrado");

        const [activeEnrollments, activeAssignments, activeBlocks] =
          await Promise.all([
            tx.inscripcion.count({
              where: { cursoId: id, estado: EstadoInscripcion.ACTIVA },
            }),
            tx.asignacionAcademica.count({
              where: { cursoId: id, activo: true },
            }),
            tx.horarioClase.count({ where: { cursoId: id, activo: true } }),
          ]);
        if (
          activeEnrollments > 0 ||
          activeAssignments > 0 ||
          activeBlocks > 0
        ) {
          throw new ConflictException({
            code: "CURSO_CON_DEPENDENCIAS_ACTIVAS",
            message:
              "No se puede desactivar el curso mientras tenga matrículas, asignaciones académicas o bloques de horario activos. Retíralos primero.",
            dependencies: {
              inscripcionesActivas: activeEnrollments,
              asignacionesActivas: activeAssignments,
              bloquesActivos: activeBlocks,
            },
          });
        }

        await Promise.all([
          tx.curso.update({ where: { id }, data: { activo: false } }),
          tx.horarioIngreso.updateMany({
            where: { cursoId: id, activo: true },
            data: { activo: false, vigenteHasta: this.today() },
          }),
          tx.auditoria.create({
            data: {
              usuarioId: actor.sub,
              accion: "CURSO_INACTIVADO",
              recurso: "cursos",
              recursoId: id,
            },
          }),
        ]);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createSchedule(
    courseId: number,
    dto: SaveScheduleDto,
    actor: AuthenticatedUser,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const course = await tx.curso.findFirst({
          where: { id: courseId, activo: true },
        });
        if (!course) throw new NotFoundException("Curso no encontrado");
        const schedule = await tx.horarioIngreso.create({
          data: this.scheduleData(courseId, dto, this.today()),
        });
        await this.auditSchedule(tx, actor, schedule.id, "HORARIO_CREADO");
        return this.scheduleResponse(schedule);
      });
    } catch (error) {
      this.rethrowScheduleConflict(error);
    }
  }

  async updateSchedule(
    courseId: number,
    scheduleId: number,
    dto: SaveScheduleDto,
    actor: AuthenticatedUser,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.horarioIngreso.findFirst({
          where: {
            id: scheduleId,
            cursoId: courseId,
            activo: true,
            vigenteHasta: null,
          },
        });
        if (!current) throw new NotFoundException("Horario no encontrado");
        const effectiveDate = this.today();
        const schedule =
          current.vigenteDesde.getTime() === effectiveDate.getTime()
            ? await tx.horarioIngreso.update({
                where: { id: scheduleId },
                data: this.scheduleData(courseId, dto, effectiveDate),
              })
            : await (async () => {
                await tx.horarioIngreso.update({
                  where: { id: scheduleId },
                  data: { activo: false, vigenteHasta: effectiveDate },
                });
                return tx.horarioIngreso.create({
                  data: this.scheduleData(courseId, dto, effectiveDate),
                });
              })();
        await this.auditSchedule(tx, actor, schedule.id, "HORARIO_ACTUALIZADO");
        return this.scheduleResponse(schedule);
      });
    } catch (error) {
      this.rethrowScheduleConflict(error);
    }
  }

  async removeSchedule(
    courseId: number,
    scheduleId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.horarioIngreso.updateMany({
        where: { id: scheduleId, cursoId: courseId, activo: true },
        data: { activo: false, vigenteHasta: this.today() },
      });
      if (!result.count) throw new NotFoundException("Horario no encontrado");
      await this.auditSchedule(tx, actor, scheduleId, "HORARIO_INACTIVADO");
    });
  }

  private courseData(dto: CreateCourseDto) {
    return {
      nombre: this.courseName(dto.nivel, dto.paralelo),
      nivel: this.courseLevel(dto.nivel),
      paralelo: dto.paralelo.trim().toUpperCase(),
      gestion: dto.gestion,
    };
  }

  private courseName(level: string, parallel: string): string {
    return this.courseLevel(level) + " " + parallel.trim().toUpperCase();
  }

  private courseLevel(level: string): string {
    const grade = level.trim().match(/^([1-6])\.º/i)?.[1];
    return `${grade}.º Secundaria`;
  }

  private scheduleData(
    courseId: number,
    dto: SaveScheduleDto,
    vigenteDesde: Date,
  ) {
    return {
      cursoId: courseId,
      jornada: dto.jornada,
      horaLimite: new Date(`1970-01-01T${dto.horaLimite}:00.000Z`),
      toleranciaMinutos: 0,
      zonaHoraria: dto.zonaHoraria?.trim() || "America/La_Paz",
      activo: true,
      vigenteDesde,
      vigenteHasta: null,
    };
  }

  private today(): Date {
    const local = DateTime.now().setZone("America/La_Paz");
    return DateTime.utc(local.year, local.month, local.day).toJSDate();
  }

  private async auditSchedule(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    scheduleId: number,
    action: string,
  ): Promise<void> {
    await tx.auditoria.create({
      data: {
        usuarioId: actor.sub,
        accion: action,
        recurso: "horarios_ingreso",
        recursoId: scheduleId,
      },
    });
  }

  private toResponse(course: {
    id: number;
    nombre: string;
    nivel: string;
    paralelo: string;
    gestion: number;
    activo: boolean;
    _count: { inscripciones: number };
    asignacionesAcademicas: Array<{ docenteId: number }>;
    horarios: Array<{
      id: number;
      jornada: "MANANA" | "TARDE" | "NOCHE";
      horaLimite: Date;
      toleranciaMinutos: number;
      zonaHoraria: string;
      activo: boolean;
    }>;
  }) {
    return {
      id: course.id,
      nombre: course.nombre,
      nivel: course.nivel,
      paralelo: course.paralelo,
      gestion: course.gestion,
      activo: course.activo,
      cantidadEstudiantes: course._count.inscripciones,
      cantidadDocentes: new Set(
        course.asignacionesAcademicas.map((assignment) => assignment.docenteId),
      ).size,
      horarios: course.horarios.map((schedule) =>
        this.scheduleResponse(schedule),
      ),
    };
  }

  private scheduleResponse(schedule: {
    id: number;
    jornada: "MANANA" | "TARDE" | "NOCHE";
    horaLimite: Date;
    toleranciaMinutos: number;
    zonaHoraria: string;
    activo: boolean;
  }) {
    return {
      id: schedule.id,
      jornada: schedule.jornada,
      horaLimite: schedule.horaLimite.toISOString().slice(11, 16),
      toleranciaMinutos: schedule.toleranciaMinutos,
      zonaHoraria: schedule.zonaHoraria,
      activo: schedule.activo,
    };
  }

  private rethrowConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictException(
        "Ya existe un curso con ese nivel, paralelo y gestión",
      );
    throw error;
  }

  private rethrowScheduleConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictException("Ya existe un horario para esa jornada");
    throw error;
  }
}
