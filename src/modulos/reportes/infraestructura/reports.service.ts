import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EstadoAsistencia,
  EstadoInscripcion,
  EstadoPeriodo,
} from "@prisma/client";
import PDFDocument from "pdfkit";
import { DateTime } from "luxon";
import { PrismaService } from "../../../comun/prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(desde: string, hasta: string, cursoId?: string) {
    const start = this.parseDate(desde, "desde");
    const end = this.parseDate(hasta, "hasta");
    if (start > end)
      throw new BadRequestException(
        "La fecha desde no puede ser posterior a hasta",
      );
    const where = {
      fechaLocal: { gte: start, lte: end },
      ...(cursoId ? { cursoId } : {}),
    };
    const [groups, enrolled] = await Promise.all([
      this.prisma.asistencia.groupBy({
        by: ["estado"],
        where,
        _count: { _all: true },
      }),
      this.prisma.inscripcion.count({
        where: {
          estado: EstadoInscripcion.ACTIVA,
          periodo: { estado: EstadoPeriodo.ACTIVO },
          ...(cursoId ? { cursoId } : {}),
        },
      }),
    ]);
    const punctual =
      groups.find((item) => item.estado === EstadoAsistencia.PUNTUAL)?._count
        ._all ?? 0;
    const late =
      groups.find((item) => item.estado === EstadoAsistencia.ATRASO)?._count
        ._all ?? 0;
    const total = punctual + late;
    const schoolDays = this.schoolDays(start, end);
    const expected = enrolled * schoolDays;
    return {
      desde,
      hasta,
      estudiantesInscritos: enrolled,
      asistenciasPuntuales: punctual,
      atrasos: late,
      totalRegistros: total,
      diasHabiles: schoolDays,
      asistenciasEsperadas: expected,
      inasistencias: Math.max(expected - total, 0),
      porcentajeAsistencia:
        expected === 0 ? 0 : Number(((total / expected) * 100).toFixed(1)),
      porcentajePuntualidad:
        total === 0 ? 0 : Number(((punctual / total) * 100).toFixed(1)),
    };
  }

  private schoolDays(start: Date, end: Date): number {
    let current = DateTime.fromJSDate(start, { zone: "utc" });
    const last = DateTime.fromJSDate(end, { zone: "utc" });
    let count = 0;
    while (current <= last) {
      if (current.weekday <= 5) count++;
      current = current.plus({ days: 1 });
    }
    return count;
  }

  async studentHistory(studentId: string, desde?: string, hasta?: string) {
    const student = await this.prisma.estudiante.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException("Estudiante no encontrado");
    const records = await this.prisma.asistencia.findMany({
      where: {
        estudianteId: studentId,
        ...(desde || hasta
          ? {
              fechaLocal: {
                ...(desde ? { gte: this.parseDate(desde, "desde") } : {}),
                ...(hasta ? { lte: this.parseDate(hasta, "hasta") } : {}),
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

  async exportPdf(desde: string, hasta: string, cursoId?: string) {
    const start = this.parseDate(desde, "desde");
    const end = this.parseDate(hasta, "hasta");
    if (start > end)
      throw new BadRequestException(
        "La fecha desde no puede ser posterior a hasta",
      );

    const [summary, records] = await Promise.all([
      this.summary(desde, hasta, cursoId),
      this.prisma.asistencia.findMany({
        where: {
          fechaLocal: { gte: start, lte: end },
          ...(cursoId ? { cursoId } : {}),
        },
        include: { estudiante: true, curso: true },
        orderBy: [{ fechaLocal: "asc" }, { fechaHora: "asc" }],
      }),
    ]);

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
      document.end();
    });
  }

  private parseDate(value: string, field: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException(`${field} debe usar el formato YYYY-MM-DD`);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.valueOf()))
      throw new BadRequestException(`${field} no es una fecha válida`);
    return date;
  }
}
