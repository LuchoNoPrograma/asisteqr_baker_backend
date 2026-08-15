import { createHash, randomUUID } from "node:crypto";
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
  Prisma,
} from "@prisma/client";
import { DateTime } from "luxon";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";

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
            take: 1,
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
  id: string;
  fechaHora: string;
  estado: EstadoAsistencia;
  duplicado: boolean;
  estudiante: {
    id: string;
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
          credential.estudiante.estado !== EstadoEstudiante.ACTIVO ||
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
          throw new NotFoundException(
            "El código QR no es válido o no está registrado",
          );
        }
        return this.registerAttendance(
          tx,
          credential.estudiante,
          actor,
          "QR",
          direccionIp,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private credentialIdFromToken(token: string): string | null {
    const match =
      /^AQB1\.v1_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
        token,
      );
    return match?.[1].toLowerCase() ?? null;
  }

  async registerManual(
    studentCode: number,
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
          throw new NotFoundException("Estudiante no encontrado");
        }
        if (student.estado !== EstadoEstudiante.ACTIVO) {
          throw new BadRequestException("El estudiante no está activo");
        }
        return this.registerAttendance(
          tx,
          student,
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
    actor: AuthenticatedUser,
    origin: "QR" | "MANUAL",
    direccionIp?: string,
  ): Promise<ScanResponse> {
    const enrollment = student.inscripciones[0];
    const schedule = enrollment?.curso.horarios[0];
    const generalConfig = enrollment?.periodo.configuracionHorario;
    if (!enrollment || !schedule)
      throw new BadRequestException(
        "El estudiante no tiene curso u horario activo",
      );
    if (!generalConfig)
      throw new BadRequestException(
        "No existe configuración general de horario para el periodo activo",
      );

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
      Array<{ id: string; fechaHora: Date; estado: EstadoAsistencia }>
    >(Prisma.sql`
      INSERT INTO asistencias (
        id, estudiante_id, curso_id, horario_id, fecha_local,
        fecha_hora, estado, origen, registrado_por_id, creado_en
      ) VALUES (
        ${randomUUID()}::uuid, ${student.id}::uuid,
        ${enrollment.cursoId}::uuid, ${schedule.id}::uuid, ${localDate},
        ${now}, ${status}::"EstadoAsistencia", ${origin}, ${actor.sub}::uuid, ${now}
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
      duplicate,
    );
  }

  async daily(fecha: string | undefined, cursoId: string | undefined) {
    const target =
      fecha ?? DateTime.now().setZone("America/La_Paz").toISODate();
    if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(target))
      throw new BadRequestException("La fecha debe usar el formato YYYY-MM-DD");
    const date = new Date(`${target}T00:00:00.000Z`);
    const enrollments = await this.prisma.inscripcion.findMany({
      where: {
        estado: EstadoInscripcion.ACTIVA,
        periodo: { estado: EstadoPeriodo.ACTIVO },
        ...(cursoId ? { cursoId } : {}),
      },
      include: { estudiante: true, curso: true },
      orderBy: [
        { curso: { nombre: "asc" } },
        { estudiante: { apellidos: "asc" } },
      ],
    });
    const attendance = await this.prisma.asistencia.findMany({
      where: { fechaLocal: date, ...(cursoId ? { cursoId } : {}) },
    });
    const byStudent = new Map(
      attendance.map((item) => [item.estudianteId, item]),
    );
    return enrollments.map((item) => {
      const record = byStudent.get(item.estudianteId);
      return {
        estudiante: {
          id: item.estudiante.id,
          codigo: item.estudiante.codigoEstudiante,
          nombreCompleto: `${item.estudiante.nombres} ${item.estudiante.apellidos}`,
          fotografiaUrl: item.estudiante.fotografiaUrl,
        },
        curso: { id: item.curso.id, nombre: item.curso.nombre },
        fechaHora: record?.fechaHora.toISOString() ?? null,
        estado: record?.estado ?? "AUSENTE",
      };
    });
  }

  private toResponse(
    attendance: { id: string; fechaHora: Date; estado: EstadoAsistencia },
    student: {
      id: string;
      codigoEstudiante: number;
      nombres: string;
      apellidos: string;
      fotografiaUrl: string | null;
    },
    course: string,
    duplicate: boolean,
  ): ScanResponse {
    return {
      id: attendance.id,
      fechaHora: attendance.fechaHora.toISOString(),
      estado: attendance.estado,
      duplicado: duplicate,
      estudiante: {
        id: student.id,
        codigo: student.codigoEstudiante,
        nombreCompleto: `${student.nombres} ${student.apellidos}`,
        curso: course,
        fotografiaUrl: student.fotografiaUrl,
      },
    };
  }
}
