import { EstadoAsistencia } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  it("calcula la cohorte vigente por fecha y excluye un día no lectivo en un periodo cerrado", async () => {
    const prisma = reportPrisma({
      periods: [period({ state: "CERRADO", holidays: ["2026-08-05"] })],
      enrollments: [
        enrollment({ studentId: 1, from: "2026-08-03" }),
        enrollment({ studentId: 2, from: "2026-08-05" }),
        enrollment({
          studentId: 3,
          from: "2026-08-03",
          until: "2026-08-06",
        }),
      ],
      records: [
        attendance({
          id: 1,
          studentId: 1,
          date: "2026-08-03",
        }),
        attendance({
          id: 2,
          studentId: 2,
          date: "2026-08-05",
        }),
        attendance({
          id: 3,
          studentId: 3,
          date: "2026-08-06",
          state: EstadoAsistencia.ATRASO,
        }),
        attendance({
          id: 4,
          studentId: 2,
          date: "2026-08-07",
          state: EstadoAsistencia.ATRASO,
        }),
      ],
    });

    const result = await new ReportsService(prisma).summary(
      "2026-08-03",
      "2026-08-07",
    );

    expect(result).toEqual({
      desde: "2026-08-03",
      hasta: "2026-08-07",
      periodosConsiderados: 1,
      estudiantesInscritos: 3,
      asistenciasPuntuales: 1,
      atrasos: 1,
      totalRegistros: 2,
      diasHabiles: 4,
      diasNoLectivos: 1,
      asistenciasEsperadas: 8,
      inasistencias: 6,
      registrosNoComputados: 2,
      porcentajeAsistencia: 25,
      porcentajePuntualidad: 50,
    });
  });

  it("cuenta cada jornada vigente como una expectativa independiente", async () => {
    const prisma = reportPrisma({
      periods: [period()],
      enrollments: [
        enrollment({
          studentId: 1,
          from: "2026-08-03",
          schedules: [
            schedule(1, "2026-08-03"),
            schedule(2, "2026-08-06"),
          ],
        }),
      ],
    });

    const result = await new ReportsService(prisma).summary(
      "2026-08-03",
      "2026-08-07",
    );

    expect(result.asistenciasEsperadas).toBe(7);
    expect(result.diasHabiles).toBe(5);
    expect(result.porcentajeAsistencia).toBe(0);
  });

  it("proyecta un cambio de curso sin reescribir la pertenencia histórica", async () => {
    const periods = [period()];
    const records: ReturnType<typeof attendance>[] = [];
    const enrollmentRows = [
      enrollment({
        studentId: 1,
        courseId: 1,
        from: "2026-08-03",
        until: "2026-08-05",
      }),
      enrollment({
        studentId: 1,
        courseId: 2,
        from: "2026-08-05",
      }),
    ];
    const prismaA = reportPrisma({
      periods,
      enrollments: enrollmentRows.filter((row) => row.cursoId === 1),
      records,
    });
    const prismaB = reportPrisma({
      periods,
      enrollments: enrollmentRows.filter((row) => row.cursoId === 2),
      records,
    });

    const [courseA, courseB] = await Promise.all([
      new ReportsService(prismaA).summary(
        "2026-08-03",
        "2026-08-07",
        1,
      ),
      new ReportsService(prismaB).summary(
        "2026-08-03",
        "2026-08-07",
        2,
      ),
    ]);

    expect(courseA.asistenciasEsperadas).toBe(2);
    expect(courseB.asistenciasEsperadas).toBe(3);
  });

  it("CP-11 genera un PDF con la misma proyección histórica del resumen", async () => {
    const reportRecord = attendance({
      id: 1,
      studentId: 1,
      date: "2026-08-07",
    });
    const prisma = reportPrisma({
      periods: [period()],
      enrollments: [
        enrollment({ studentId: 1, from: "2026-08-03" }),
      ],
      records: [reportRecord],
      pdfRecords: [
        {
          fechaLocal: new Date("2026-08-07T00:00:00.000Z"),
          fechaHora: new Date("2026-08-07T11:55:00.000Z"),
          estado: EstadoAsistencia.PUNTUAL,
          estudiante: { nombres: "Valeria", apellidos: "Mendoza Rojas" },
          curso: { nombre: "4.º Secundaria B" },
        },
      ],
    });

    const pdf = await new ReportsService(prisma).exportPdf(
      "2026-08-03",
      "2026-08-07",
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    expect(prisma.asistencia.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: { in: [1] } } }),
    );
  });

  it("rechaza una fecha inexistente en resumen antes de consultar Prisma", async () => {
    const findMany = jest.fn();
    const prisma = {
      periodoAcademico: { findMany },
    } as unknown as PrismaService;

    await expect(
      new ReportsService(prisma).summary("2026-02-29", "2026-03-01"),
    ).rejects.toMatchObject({ status: 400 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rechaza rangos invertidos en resumen", async () => {
    const findMany = jest.fn();
    const prisma = {
      periodoAcademico: { findMany },
    } as unknown as PrismaService;

    await expect(
      new ReportsService(prisma).summary("2026-03-02", "2026-03-01"),
    ).rejects.toMatchObject({ status: 400 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("valida fechas del historial antes de buscar al estudiante", async () => {
    const prisma = {
      estudiante: { findUnique: jest.fn() },
      asistencia: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const service = new ReportsService(prisma);

    await expect(
      service.studentHistory(
        1,
        "2026-04-31",
        "2026-05-01",
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.estudiante.findUnique).not.toHaveBeenCalled();
  });

  it("acepta una fecha bisiesta válida en resumen", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      periodoAcademico: { findMany },
      asistencia: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await new ReportsService(prisma).summary("2028-02-29", "2028-02-29");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaInicio: { lte: new Date("2028-02-29T00:00:00.000Z") },
          fechaFin: { gte: new Date("2028-02-29T00:00:00.000Z") },
        }),
      }),
    );
  });
});

function reportPrisma({
  periods,
  enrollments,
  records = [],
  pdfRecords,
}: {
  periods: ReturnType<typeof period>[];
  enrollments: ReturnType<typeof enrollment>[];
  records?: ReturnType<typeof attendance>[];
  pdfRecords?: unknown[];
}) {
  const attendanceFindMany = jest
    .fn()
    .mockResolvedValueOnce(records)
    .mockResolvedValueOnce(pdfRecords ?? []);
  return {
    periodoAcademico: { findMany: jest.fn().mockResolvedValue(periods) },
    inscripcion: { findMany: jest.fn().mockResolvedValue(enrollments) },
    asistencia: { findMany: attendanceFindMany },
  } as unknown as PrismaService & {
    asistencia: { findMany: jest.Mock };
  };
}

function period({
  state = "ACTIVO",
  holidays = [],
}: {
  state?: "ACTIVO" | "CERRADO";
  holidays?: string[];
} = {}) {
  return {
    id: 1,
    estado: state,
    fechaInicio: new Date("2026-08-03T00:00:00.000Z"),
    fechaFin: new Date("2026-08-07T00:00:00.000Z"),
    diasNoLectivos: holidays.map((date) => ({ fecha: calendarDate(date) })),
  };
}

function enrollment({
  studentId,
  courseId = 1,
  from,
  until,
  schedules = [schedule(1, "2026-08-03")],
}: {
  studentId: number;
  courseId?: number;
  from: string;
  until?: string;
  schedules?: ReturnType<typeof schedule>[];
}) {
  return {
    estudianteId: studentId,
    cursoId: courseId,
    periodoId: 1,
    vigenteDesde: calendarDate(from),
    vigenteHasta: until ? calendarDate(until) : null,
    curso: { horarios: schedules },
  };
}

function schedule(id: number, from: string, until?: string) {
  return {
    id,
    vigenteDesde: calendarDate(from),
    vigenteHasta: until ? calendarDate(until) : null,
  };
}

function attendance({
  id,
  studentId,
  courseId = 1,
  scheduleId = 1,
  date,
  state = EstadoAsistencia.PUNTUAL,
}: {
  id: number;
  studentId: number;
  courseId?: number;
  scheduleId?: number;
  date: string;
  state?: EstadoAsistencia;
}) {
  return {
    id,
    estudianteId: studentId,
    cursoId: courseId,
    horarioId: scheduleId,
    fechaLocal: calendarDate(date),
    estado: state,
  };
}

function calendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
