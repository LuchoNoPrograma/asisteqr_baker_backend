import { createHash } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EstadoAsistencia,
  EstadoCredencial,
  EstadoEstudiante,
  EstadoInscripcion,
  EstadoPeriodo,
  Jornada,
  Prisma,
} from "@prisma/client";
import { DateTime } from "luxon";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { parseCalendarDate } from "../../../comun/validacion/calendar-date";

const attendanceStudentInclude = {
  inscripciones: {
    where: {
      estado: EstadoInscripcion.ACTIVA,
      periodo: { estado: EstadoPeriodo.ACTIVO },
    },
    include: {
      curso: {
        include: {
          horarios: {
            where: { activo: true },
            orderBy: { jornada: "asc" as const },
          },
        },
      },
      periodo: { include: { configuracionHorario: true } },
    },
    take: 1,
  },
} satisfies Prisma.EstudianteInclude;

type AttendanceStudent = Prisma.EstudianteGetPayload<{
  include: typeof attendanceStudentInclude;
}>;

export interface ScanResponse {
  id: number;
  fechaHora: string;
  estado: EstadoAsistencia;
  duplicado: boolean;
  horario: {
    id: number;
    jornada: Jornada;
    horaLimite: string;
  };
  estudiante: {
    id: number;
    codigo: number;
    nombreCompleto: string;
    curso: string;
    fotografiaUrl: string | null;
  };
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async scan(
    tokenQr: string,
    shift: Jornada,
    actor: AuthenticatedUser,
    direccionIp?: string,
  ): Promise<ScanResponse> {
    const normalizedToken = tokenQr.trim();
    const credentialId = this.credentialIdFromToken(normalizedToken);
    return this.prisma.$transaction(
      async (tx) => {
        const credential = await tx.credencialQr.findUnique({
          where: credentialId
            ? { id: credentialId }
            : {
                tokenHash: createHash("sha256")
                  .update(normalizedToken)
                  .digest("hex"),
              },
          include: {
            estudiante: {
              include: attendanceStudentInclude,
            },
          },
        });
        const now = new Date();
        if (
          !credential ||
          credential.estado !== EstadoCredencial.ACTIVA ||
          credential.vigenteDesde > now ||
          (credential.vigenteHasta && credential.vigenteHasta < now)
        ) {
          await tx.auditoria.create({
            data: {
              usuarioId: actor.sub,
              accion: "QR_RECHAZADO",
              recurso: "asistencias",
              metadatos: { motivo: "NO_REGISTRADO_O_INACTIVO" },
              direccionIp,
            },
          });
          throw new NotFoundException({
            code: "QR_INVALIDO",
            message: "El código QR no es válido o no está registrado",
          });
        }
        if (credential.estudiante.estado !== EstadoEstudiante.ACTIVO) {
          await tx.auditoria.create({
            data: {
              usuarioId: actor.sub,
              accion: "QR_RECHAZADO",
              recurso: "asistencias",
              metadatos: { motivo: "ESTUDIANTE_INACTIVO" },
              direccionIp,
            },
          });
          throw new BadRequestException({
            code: "ESTUDIANTE_INACTIVO",
            message: "El estudiante no está activo",
          });
        }
        return this.registerAttendance(
          tx,
          credential.estudiante,
          shift,
          actor,
          "QR",
          direccionIp,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private credentialIdFromToken(token: string): number | null {
    const match = /^AQB1\.v1_([1-9]\d*)$/.exec(token);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isSafeInteger(id) ? id : null;
  }

  async registerManual(
    studentCode: number,
    shift: Jornada,
    actor: AuthenticatedUser,
    direccionIp?: string,
  ): Promise<ScanResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        const student = await tx.estudiante.findUnique({
          where: { codigoEstudiante: studentCode },
          include: attendanceStudentInclude,
        });
        if (!student) {
          await tx.auditoria.create({
            data: {
              usuarioId: actor.sub,
              accion: "ASISTENCIA_MANUAL_RECHAZADA",
              recurso: "asistencias",
              metadatos: {
                motivo: "ESTUDIANTE_NO_ENCONTRADO",
                codigoEstudiante: studentCode,
              },
              direccionIp,
            },
          });
          throw new NotFoundException({
            code: "ESTUDIANTE_NO_ENCONTRADO",
            message: "Estudiante no encontrado",
          });
        }
        if (student.estado !== EstadoEstudiante.ACTIVO) {
          throw new BadRequestException({
            code: "ESTUDIANTE_INACTIVO",
            message: "El estudiante no está activo",
          });
        }
        return this.registerAttendance(
          tx,
          student,
          shift,
          actor,
          "MANUAL",
          direccionIp,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async registerAttendance(
    tx: Prisma.TransactionClient,
    student: AttendanceStudent,
    shift: Jornada,
    actor: AuthenticatedUser,
    origin: "QR" | "MANUAL",
    direccionIp?: string,
  ): Promise<ScanResponse> {
    const enrollment = student.inscripciones[0];
    const schedules = enrollment?.curso.horarios ?? [];
    const schedule = schedules.find((item) => item.jornada === shift);
    const generalConfig = enrollment?.periodo.configuracionHorario;
    if (!enrollment)
      throw new BadRequestException({
        code: "INSCRIPCION_ACTIVA_AUSENTE",
        message: "El estudiante no tiene una inscripción activa",
      });
    if (schedules.length === 0)
      throw new BadRequestException({
        code: "HORARIO_ACTIVO_AUSENTE",
        message: "El curso no tiene un horario de ingreso activo",
      });
    if (!schedule)
      throw new BadRequestException({
        code: "HORARIO_JORNADA_AUSENTE",
        message: `El curso no tiene un horario activo para la jornada ${shift}`,
      });
    if (!generalConfig)
      throw new BadRequestException({
        code: "CONFIGURACION_HORARIA_AUSENTE",
        message:
          "No existe configuración general de horario para el periodo activo",
      });

    const now = new Date();
    const localNow = DateTime.fromJSDate(now).setZone(
      generalConfig.zonaHoraria,
    );
    const localDate = new Date(`${localNow.toISODate()}T00:00:00.000Z`);
    const limitBase = DateTime.fromJSDate(schedule.horaLimite, {
      zone: "utc",
    });
    const limit = localNow
      .set({
        hour: limitBase.hour,
        minute: limitBase.minute,
        second: 0,
        millisecond: 0,
      })
      .plus({ minutes: generalConfig.toleranciaMinutos });
    const status =
      localNow > limit ? EstadoAsistencia.ATRASO : EstadoAsistencia.PUNTUAL;

    const inserted = await tx.$queryRaw<
      Array<{ id: number; fechaHora: Date; estado: EstadoAsistencia }>
    >(Prisma.sql`
      INSERT INTO asistencias (
        estudiante_id, curso_id, horario_id, fecha_local,
        fecha_hora, estado, origen, registrado_por_id, creado_en
      ) VALUES (
        ${student.id}, ${enrollment.cursoId}, ${schedule.id}, ${localDate},
        ${now}, ${status}::"EstadoAsistencia", ${origin}, ${actor.sub}, ${now}
      )
      ON CONFLICT (estudiante_id, horario_id, fecha_local) DO NOTHING
      RETURNING id, fecha_hora AS "fechaHora", estado
    `);
    const duplicate = inserted.length === 0;
    const attendance =
      inserted[0] ??
      (await tx.asistencia.findUniqueOrThrow({
        where: {
          estudianteId_horarioId_fechaLocal: {
            estudianteId: student.id,
            horarioId: schedule.id,
            fechaLocal: localDate,
          },
        },
        select: { id: true, fechaHora: true, estado: true },
      }));

    await tx.auditoria.create({
      data: {
        usuarioId: actor.sub,
        accion: duplicate ? "ASISTENCIA_DUPLICADA" : "ASISTENCIA_REGISTRADA",
        recurso: "asistencias",
        recursoId: attendance.id,
        metadatos: {
          estudianteId: student.id,
          horarioId: schedule.id,
          jornada: schedule.jornada,
          estado: attendance.estado,
          origen: origin,
        },
        direccionIp,
      },
    });
    return this.toResponse(
      attendance,
      student,
      enrollment.curso.nombre,
      schedule,
      duplicate,
    );
  }

  async availableShifts(): Promise<Array<{ jornada: Jornada }>> {
    const schedules = await this.prisma.horarioIngreso.findMany({
      where: {
        activo: true,
        curso: {
          activo: true,
          inscripciones: {
            some: {
              estado: EstadoInscripcion.ACTIVA,
              periodo: { estado: EstadoPeriodo.ACTIVO },
            },
          },
        },
      },
      distinct: ["jornada"],
      select: { jornada: true },
    });
    const order = [Jornada.MANANA, Jornada.TARDE, Jornada.NOCHE];
    return schedules.toSorted(
      (first, second) =>
        order.indexOf(first.jornada) - order.indexOf(second.jornada),
    );
  }

  async daily(
    fecha: string | undefined,
    cursoId: number | undefined,
    shift?: Jornada,
  ) {
    const target =
      fecha ?? DateTime.now().setZone("America/La_Paz").toISODate();
    if (!target)
      throw new BadRequestException("La fecha debe usar el formato YYYY-MM-DD");
    const date = parseCalendarDate(target, "La fecha");
    if ([0, 6].includes(date.getUTCDay())) return [];
    const enrollments = await this.prisma.inscripcion.findMany({
      where: {
        vigenteDesde: { lte: date },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: date } }],
        periodo: {
          estado: { in: [EstadoPeriodo.ACTIVO, EstadoPeriodo.CERRADO] },
          fechaInicio: { lte: date },
          fechaFin: { gte: date },
          diasNoLectivos: { none: { fecha: date } },
        },
        ...(cursoId ? { cursoId } : {}),
      },
      include: {
        estudiante: true,
        curso: {
          include: {
            horarios: {
              where: {
                vigenteDesde: { lte: date },
                OR: [
                  { vigenteHasta: null },
                  { vigenteHasta: { gt: date } },
                ],
                ...(shift ? { jornada: shift } : {}),
              },
              orderBy: { jornada: "asc" },
            },
          },
        },
      },
      orderBy: [
        { curso: { nombre: "asc" } },
        { estudiante: { apellidos: "asc" } },
      ],
    });
    const attendance = await this.prisma.asistencia.findMany({
      where: {
        fechaLocal: date,
        ...(cursoId ? { cursoId } : {}),
        ...(shift ? { horario: { jornada: shift } } : {}),
      },
    });
    const byStudentAndSchedule = new Map(
      attendance.map((item) => [
        `${item.estudianteId}:${item.horarioId}`,
        item,
      ]),
    );
    return enrollments.flatMap((item) =>
      item.curso.horarios.map((schedule) => {
        const record = byStudentAndSchedule.get(
          `${item.estudianteId}:${schedule.id}`,
        );
        return {
          id: record?.id ?? null,
          estudiante: {
            id: item.estudiante.id,
            codigo: item.estudiante.codigoEstudiante,
            nombreCompleto: `${item.estudiante.nombres} ${item.estudiante.apellidos}`,
            fotografiaUrl: item.estudiante.fotografiaUrl,
          },
          curso: { id: item.curso.id, nombre: item.curso.nombre },
          horario: this.scheduleResponse(schedule),
          fechaHora: record?.fechaHora.toISOString() ?? null,
          estado: record?.estado ?? "AUSENTE",
        };
      }),
    );
  }

  private toResponse(
    attendance: { id: number; fechaHora: Date; estado: EstadoAsistencia },
    student: {
      id: number;
      codigoEstudiante: number;
      nombres: string;
      apellidos: string;
      fotografiaUrl: string | null;
    },
    course: string,
    schedule: {
      id: number;
      jornada: Jornada;
      horaLimite: Date;
    },
    duplicate: boolean,
  ): ScanResponse {
    return {
      id: attendance.id,
      fechaHora: attendance.fechaHora.toISOString(),
      estado: attendance.estado,
      duplicado: duplicate,
      horario: this.scheduleResponse(schedule),
      estudiante: {
        id: student.id,
        codigo: student.codigoEstudiante,
        nombreCompleto: `${student.nombres} ${student.apellidos}`,
        curso: course,
        fotografiaUrl: student.fotografiaUrl,
      },
    };
  }

  private scheduleResponse(schedule: {
    id: number;
    jornada: Jornada;
    horaLimite: Date;
  }) {
    return {
      id: schedule.id,
      jornada: schedule.jornada,
      horaLimite: schedule.horaLimite.toISOString().slice(11, 16),
    };
  }
}
