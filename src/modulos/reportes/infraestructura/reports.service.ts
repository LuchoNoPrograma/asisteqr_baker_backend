import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EstadoAsistencia, EstadoPeriodo } from "@prisma/client";
import PDFDocument from "pdfkit";
import { DateTime } from "luxon";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { parseCalendarDate } from "../../../comun/validacion/calendar-date";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(desde: string, hasta: string, cursoId?: number) {
    const start = this.parseDate(desde, "desde");
    const end = this.parseDate(hasta, "hasta");
    this.validateRange(start, end);
    const snapshot = await this.reportSnapshot(start, end, cursoId);
    return this.summaryResponse(desde, hasta, snapshot);
  }

  async studentHistory(studentId: number, desde?: string, hasta?: string) {
    const start = desde ? parseCalendarDate(desde, "desde") : undefined;
    const end = hasta ? parseCalendarDate(hasta, "hasta") : undefined;
    if (start && end && start > end)
      throw new BadRequestException(
        "La fecha desde no puede ser posterior a hasta",
      );
    const student = await this.prisma.estudiante.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException("Estudiante no encontrado");
    const records = await this.prisma.asistencia.findMany({
      where: {
        estudianteId: studentId,
        ...(start || end
          ? {
              fechaLocal: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
      include: { curso: true },
      orderBy: { fechaHora: "desc" },
    });
    return {
      estudiante: {
        id: student.id,
        codigo: student.codigoEstudiante,
        nombreCompleto: `${student.nombres} ${student.apellidos}`,
        fotografiaUrl: student.fotografiaUrl,
      },
      registros: records.map((record) => ({
        id: record.id,
        fecha: record.fechaLocal.toISOString().slice(0, 10),
        fechaHora: record.fechaHora.toISOString(),
        estado: record.estado,
        curso: record.curso.nombre,
      })),
    };
  }

  async exportPdf(desde: string, hasta: string, cursoId?: number) {
    const start = this.parseDate(desde, "desde");
    const end = this.parseDate(hasta, "hasta");
    this.validateRange(start, end);
    const snapshot = await this.reportSnapshot(start, end, cursoId);
    const summary = this.summaryResponse(desde, hasta, snapshot);
    const records = snapshot.validRecordIds.length
      ? await this.prisma.asistencia.findMany({
          where: { id: { in: snapshot.validRecordIds } },
          include: { estudiante: true, curso: true },
          orderBy: [{ fechaLocal: "asc" }, { fechaHora: "asc" }],
        })
      : [];

    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        margin: 42,
        info: { Title: `Reporte AsisteQR ${desde} - ${hasta}` },
      });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("error", reject);
      document.on("end", () => resolve(Buffer.concat(chunks)));

      document
        .fillColor("#173B57")
        .fontSize(20)
        .text("AsisteQR Baker", { continued: false });
      document
        .fillColor("#243746")
        .fontSize(13)
        .text("Reporte de asistencia", { continued: false });
      document
        .fillColor("#5C6B76")
        .fontSize(9)
        .text(`Periodo: ${desde} al ${hasta}`)
        .moveDown(1);

      const summaryLine = [
        `Inscritos: ${summary.estudiantesInscritos}`,
        `Puntuales: ${summary.asistenciasPuntuales}`,
        `Atrasos: ${summary.atrasos}`,
        `Registros: ${summary.totalRegistros}`,
      ].join("    ");
      document
        .fillColor("#173B57")
        .fontSize(10)
        .text(summaryLine)
        .moveDown(1.2);

      const drawHeader = () => {
        document
          .rect(42, document.y, 511, 22)
          .fill("#173B57")
          .fillColor("#FFFFFF")
          .fontSize(8);
        const y = document.y + 7;
        document.text("Fecha", 48, y, { width: 65 });
        document.text("Estudiante", 116, y, { width: 185 });
        document.text("Curso", 305, y, { width: 145 });
        document.text("Estado", 454, y, { width: 90 });
        document.y += 27;
      };

      drawHeader();
      for (const record of records) {
        if (document.y > 750) {
          document.addPage();
          drawHeader();
        }
        const rowY = document.y;
        document
          .fillColor("#243746")
          .fontSize(8)
          .text(record.fechaLocal.toISOString().slice(0, 10), 48, rowY, {
            width: 65,
          })
          .text(
            `${record.estudiante.nombres} ${record.estudiante.apellidos}`,
            116,
            rowY,
            { width: 185 },
          )
          .text(record.curso.nombre, 305, rowY, { width: 145 })
          .text(
            record.estado === EstadoAsistencia.ATRASO ? "Atraso" : "Puntual",
            454,
            rowY,
            {
              width: 90,
            },
          );
        document
          .moveTo(42, rowY + 17)
          .lineTo(553, rowY + 17)
          .strokeColor("#D8E0E6")
          .stroke();
        document.y = rowY + 22;
      }
      if (records.length === 0) {
        document
          .fillColor("#5C6B76")
          .fontSize(9)
          .text("No existen registros para el periodo seleccionado.");
      }
      if (summary.registrosNoComputados > 0) {
        document
          .moveDown(0.6)
          .fillColor("#8A4B08")
          .fontSize(8)
          .text(
            `${summary.registrosNoComputados} registro(s) quedaron fuera del cálculo por no corresponder a una matrícula, jornada o día lectivo vigente.`,
          );
      }
      document.end();
    });
  }

  private async reportSnapshot(start: Date, end: Date, cursoId?: number) {
    const periods = await this.prisma.periodoAcademico.findMany({
      where: {
        estado: { in: [EstadoPeriodo.ACTIVO, EstadoPeriodo.CERRADO] },
        fechaInicio: { lte: end },
        fechaFin: { gte: start },
      },
      select: {
        id: true,
        fechaInicio: true,
        fechaFin: true,
        diasNoLectivos: {
          where: { fecha: { gte: start, lte: end } },
          select: { fecha: true },
        },
      },
      orderBy: { fechaInicio: "asc" },
    });
    const periodIds = periods.map((period) => period.id);
    if (!periodIds.length) {
      const records = await this.reportAttendanceRecords(start, end, cursoId);
      return {
        periodCount: 0,
        nonInstructionalDays: 0,
        schoolDays: 0,
        enrolledStudents: 0,
        expectedAttendances: 0,
        punctualAttendances: 0,
        lateAttendances: 0,
        ignoredRecords: records.length,
        validRecordIds: [] as number[],
      };
    }

    const [enrollments, records] = await Promise.all([
      this.prisma.inscripcion.findMany({
        where: {
          periodoId: { in: periodIds },
          vigenteDesde: { lte: end },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: start } }],
          ...(cursoId ? { cursoId } : {}),
        },
        select: {
          estudianteId: true,
          cursoId: true,
          periodoId: true,
          vigenteDesde: true,
          vigenteHasta: true,
          curso: {
            select: {
              horarios: {
                where: {
                  vigenteDesde: { lte: end },
                  OR: [
                    { vigenteHasta: null },
                    { vigenteHasta: { gt: start } },
                  ],
                },
                select: {
                  id: true,
                  vigenteDesde: true,
                  vigenteHasta: true,
                },
              },
            },
          },
        },
      }),
      this.reportAttendanceRecords(start, end, cursoId),
    ]);

    const enrollmentsByPeriod = new Map<number, typeof enrollments>();
    for (const enrollment of enrollments) {
      const current = enrollmentsByPeriod.get(enrollment.periodoId) ?? [];
      current.push(enrollment);
      enrollmentsByPeriod.set(enrollment.periodoId, current);
    }

    const expectedKeys = new Set<string>();
    const enrolledStudentIds = new Set<number>();
    const schoolDateKeys = new Set<string>();
    const nonInstructionalDateKeys = new Set<string>();
    for (const period of periods) {
      const first = start > period.fechaInicio ? start : period.fechaInicio;
      const last = end < period.fechaFin ? end : period.fechaFin;
      const excluded = new Set(
        period.diasNoLectivos.map((day) => this.dateKey(day.fecha)),
      );
      let current = DateTime.fromJSDate(first, { zone: "utc" });
      const finalDay = DateTime.fromJSDate(last, { zone: "utc" });
      while (current <= finalDay) {
        const date = current.toJSDate();
        const dateKey = current.toISODate()!;
        if (current.weekday <= 5 && excluded.has(dateKey)) {
          nonInstructionalDateKeys.add(dateKey);
        } else if (current.weekday <= 5) {
          schoolDateKeys.add(dateKey);
          for (const enrollment of enrollmentsByPeriod.get(period.id) ?? []) {
            if (!this.isEffective(date, enrollment)) continue;
            enrolledStudentIds.add(enrollment.estudianteId);
            for (const schedule of enrollment.curso.horarios) {
              if (!this.isEffective(date, schedule)) continue;
              expectedKeys.add(
                this.expectationKey(
                  enrollment.estudianteId,
                  enrollment.cursoId,
                  schedule.id,
                  dateKey,
                ),
              );
            }
          }
        }
        current = current.plus({ days: 1 });
      }
    }

    let punctual = 0;
    let late = 0;
    const validRecordIds: number[] = [];
    for (const record of records) {
      const key = this.expectationKey(
        record.estudianteId,
        record.cursoId,
        record.horarioId,
        this.dateKey(record.fechaLocal),
      );
      if (!expectedKeys.has(key)) continue;
      validRecordIds.push(record.id);
      if (record.estado === EstadoAsistencia.PUNTUAL) punctual++;
      if (record.estado === EstadoAsistencia.ATRASO) late++;
    }

    return {
      periodCount: periods.length,
      nonInstructionalDays: nonInstructionalDateKeys.size,
      schoolDays: schoolDateKeys.size,
      enrolledStudents: enrolledStudentIds.size,
      expectedAttendances: expectedKeys.size,
      punctualAttendances: punctual,
      lateAttendances: late,
      ignoredRecords: records.length - validRecordIds.length,
      validRecordIds,
    };
  }

  private reportAttendanceRecords(
    start: Date,
    end: Date,
    cursoId?: number,
  ) {
    return this.prisma.asistencia.findMany({
      where: {
        fechaLocal: { gte: start, lte: end },
        ...(cursoId ? { cursoId } : {}),
      },
      select: {
        id: true,
        estudianteId: true,
        cursoId: true,
        horarioId: true,
        fechaLocal: true,
        estado: true,
      },
    });
  }

  private summaryResponse(
    desde: string,
    hasta: string,
    snapshot: Awaited<ReturnType<ReportsService["reportSnapshot"]>>,
  ) {
    const total =
      snapshot.punctualAttendances + snapshot.lateAttendances;
    const expected = snapshot.expectedAttendances;
    return {
      desde,
      hasta,
      periodosConsiderados: snapshot.periodCount,
      estudiantesInscritos: snapshot.enrolledStudents,
      asistenciasPuntuales: snapshot.punctualAttendances,
      atrasos: snapshot.lateAttendances,
      totalRegistros: total,
      diasHabiles: snapshot.schoolDays,
      diasNoLectivos: snapshot.nonInstructionalDays,
      asistenciasEsperadas: expected,
      inasistencias: expected - total,
      registrosNoComputados: snapshot.ignoredRecords,
      porcentajeAsistencia:
        expected === 0 ? 0 : Number(((total / expected) * 100).toFixed(1)),
      porcentajePuntualidad:
        total === 0
          ? 0
          : Number(
              ((snapshot.punctualAttendances / total) * 100).toFixed(1),
            ),
    };
  }

  private expectationKey(
    studentId: number,
    courseId: number,
    scheduleId: number,
    date: string,
  ): string {
    return `${studentId}:${courseId}:${scheduleId}:${date}`;
  }

  private isEffective(
    date: Date,
    interval: { vigenteDesde: Date; vigenteHasta: Date | null },
  ): boolean {
    return (
      interval.vigenteDesde <= date &&
      (interval.vigenteHasta === null || date < interval.vigenteHasta)
    );
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private validateRange(start: Date, end: Date): void {
    if (start > end)
      throw new BadRequestException(
        "La fecha desde no puede ser posterior a hasta",
      );
  }

  private parseDate(value: string, field: string): Date {
    return parseCalendarDate(value, field);
  }
}
