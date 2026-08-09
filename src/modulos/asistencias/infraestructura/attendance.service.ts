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
    const tokenHash = createHash("sha256").update(tokenQr.trim()).digest("hex");
    return this.prisma.$transaction(
      async (tx) => {
        const credential = await tx.credencialQr.findUnique({
          where: { tokenHash },
          include: {
            estudiante: {
              include: {
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
                          orderBy: { jornada: "asc" },
                          take: 1,
                        },
                        planillaHorario: {
                          orderBy: [{ diaSemana: "asc" }, { hora: "asc" }],
                        },
                      },
                    },
                    periodo: true,
                  },
                  take: 1,
                },
              },
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
        const enrollment = credential.estudiante.inscripciones[0];
        const schedule = enrollment?.curso.horarios[0];
        if (!enrollment || !schedule)
          throw new BadRequestException(
            "El estudiante no tiene curso u horario activo",
          );

        const localNow = DateTime.fromJSDate(now).setZone(schedule.zonaHoraria);
        const localDate = new Date(`${localNow.toISODate()}T00:00:00.000Z`);
        const limitBase = DateTime.fromJSDate(schedule.horaLimite, {
          zone: "utc",
        });
        const weeklyCells = enrollment.curso.planillaHorario ?? [];
        const firstHourToday = weeklyCells
          .filter((cell) => cell.diaSemana === localNow.weekday)
          .reduce<number | null>(
            (first, cell) =>
              first === null || cell.hora < first ? cell.hora : first,
            null,
          );
        if (weeklyCells.length > 0 && firstHourToday === null) {
          throw new BadRequestException(
            "El curso no tiene clases programadas para hoy",
          );
        }
        const limit = localNow
          .set({
            hour: firstHourToday ?? limitBase.hour,
            minute: firstHourToday === null ? limitBase.minute : 0,
            second: 0,
            millisecond: 0,
          })
          .plus({ minutes: schedule.toleranciaMinutos });
        const status =
          localNow > limit ? EstadoAsistencia.ATRASO : EstadoAsistencia.PUNTUAL;

        const inserted = await tx.$queryRaw<
          Array<{ id: string; fechaHora: Date; estado: EstadoAsistencia }>
        >(Prisma.sql`
          INSERT INTO asistencias (
            id, estudiante_id, curso_id, horario_id, fecha_local,
            fecha_hora, estado, origen, registrado_por_id, creado_en
          ) VALUES (
            ${randomUUID()}::uuid, ${credential.estudiante.id}::uuid,
            ${enrollment.cursoId}::uuid, ${schedule.id}::uuid, ${localDate},
            ${now}, ${status}::"EstadoAsistencia", 'QR', ${actor.sub}::uuid, ${now}
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
                estudianteId: credential.estudiante.id,
                horarioId: schedule.id,
                fechaLocal: localDate,
              },
            },
            select: { id: true, fechaHora: true, estado: true },
          }));

        await tx.auditoria.create({
          data: {
            usuarioId: actor.sub,
            accion: duplicate
              ? "ASISTENCIA_DUPLICADA"
              : "ASISTENCIA_REGISTRADA",
            recurso: "asistencias",
            recursoId: attendance.id,
            metadatos: {
              estudianteId: credential.estudiante.id,
              estado: attendance.estado,
            },
            direccionIp,
          },
        });
        return this.toResponse(
          attendance,
          credential.estudiante,
          enrollment.curso.nombre,
          duplicate,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
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
