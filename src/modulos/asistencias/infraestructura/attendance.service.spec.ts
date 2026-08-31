import {
  EstadoAsistencia,
  EstadoCredencial,
  EstadoEstudiante,
  EstadoInscripcion,
  EstadoPeriodo,
  Jornada,
} from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { AttendanceService } from "./attendance.service";

const actor: AuthenticatedUser = {
  sub: 99,
  usuario: "regente",
  nombreCompleto: "Regente Baker",
  roles: ["REGENTE"],
  sesionId: 98,
};

describe("AttendanceService", () => {
  it("CP-03 rechaza un QR no registrado sin insertar asistencia", async () => {
    const tx = {
      credencialQr: { findUnique: jest.fn().mockResolvedValue(null) },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
      asistencia: { findUniqueOrThrow: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const service = new AttendanceService(prisma as unknown as PrismaService);

    await expect(
      service.scan("QR-NO-REGISTRADO", Jornada.MANANA, actor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "QR_INVALIDO" }),
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.auditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "QR_RECHAZADO" }),
      }),
    );
  });

  it("CP-01 identifica estudiante y registra una asistencia valida", async () => {
    const now = new Date();
    const credential = {
      estado: EstadoCredencial.ACTIVA,
      vigenteDesde: new Date(now.getTime() - 60_000),
      vigenteHasta: null,
      estudiante: {
        id: 1,
        codigoEstudiante: 1,
        nombres: "Valeria",
        apellidos: "Mendoza Rojas",
        fotografiaUrl: "/foto.jpg",
        estado: EstadoEstudiante.ACTIVO,
        inscripciones: [
          {
            id: 1,
            estudianteId: 1,
            cursoId: 1,
            periodoId: 1,
            estado: EstadoInscripcion.ACTIVA,
            creadoEn: now,
            periodo: {
              estado: EstadoPeriodo.ACTIVO,
              configuracionHorario: {
                toleranciaMinutos: 5,
                zonaHoraria: "America/La_Paz",
              },
            },
            curso: {
              id: 1,
              nombre: "4.º Secundaria B",
              horarios: [
                {
                  id: 1,
                  jornada: Jornada.MANANA,
                  horaLimite: new Date("1970-01-01T23:59:00Z"),
                  toleranciaMinutos: 0,
                  zonaHoraria: "America/La_Paz",
                  activo: true,
                },
              ],
            },
          },
        ],
      },
    };
    const attendance = {
      id: 1,
      fechaHora: now,
      estado: EstadoAsistencia.PUNTUAL,
    };
    const tx = {
      credencialQr: { findUnique: jest.fn().mockResolvedValue(credential) },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
      asistencia: { findUniqueOrThrow: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([attendance]),
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const service = new AttendanceService(prisma as unknown as PrismaService);

    const result = await service.scan(
      "AQB1.v1_1",
      Jornada.MANANA,
      actor,
    );

    expect(result.duplicado).toBe(false);
    expect(result.estudiante.nombreCompleto).toBe("Valeria Mendoza Rojas");
    expect(result.estudiante.curso).toBe("4.º Secundaria B");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.credencialQr.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
      }),
    );
  });

  it("registra asistencia manual por codigo de estudiante", async () => {
    const now = new Date();
    const student = {
      id: 1,
      codigoEstudiante: 148,
      nombres: "Valeria",
      apellidos: "Mendoza Rojas",
      fotografiaUrl: "/foto.jpg",
      estado: EstadoEstudiante.ACTIVO,
      inscripciones: [
        {
          id: 1,
          estudianteId: 1,
          cursoId: 1,
          periodoId: 1,
          estado: EstadoInscripcion.ACTIVA,
          creadoEn: now,
          periodo: {
            estado: EstadoPeriodo.ACTIVO,
            configuracionHorario: {
              toleranciaMinutos: 5,
              zonaHoraria: "America/La_Paz",
            },
          },
          curso: {
            id: 1,
            nombre: "4.º Secundaria B",
            horarios: [
              {
                id: 1,
                jornada: Jornada.MANANA,
                horaLimite: new Date("1970-01-01T23:59:00Z"),
                toleranciaMinutos: 0,
                zonaHoraria: "America/La_Paz",
                activo: true,
              },
            ],
          },
        },
      ],
    };
    const attendance = {
      id: 2,
      fechaHora: now,
      estado: EstadoAsistencia.PUNTUAL,
    };
    const tx = {
      estudiante: { findUnique: jest.fn().mockResolvedValue(student) },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
      asistencia: { findUniqueOrThrow: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([attendance]),
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const service = new AttendanceService(prisma as unknown as PrismaService);

    const result = await service.registerManual(148, Jornada.MANANA, actor);

    expect(tx.estudiante.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { codigoEstudiante: 148 } }),
    );
    expect(result.estudiante.codigo).toBe(148);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.auditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadatos: expect.objectContaining({ origen: "MANUAL" }),
        }),
      }),
    );
  });

  it("rechaza un ID manual inexistente sin insertar asistencia", async () => {
    const tx = {
      estudiante: { findUnique: jest.fn().mockResolvedValue(null) },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
      asistencia: { findUniqueOrThrow: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const service = new AttendanceService(prisma as unknown as PrismaService);

    await expect(
      service.registerManual(999, Jornada.MANANA, actor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ESTUDIANTE_NO_ENCONTRADO" }),
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.auditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: "ASISTENCIA_MANUAL_RECHAZADA",
        }),
      }),
    );
  });

  it.each([
    {
      escenario: "el estudiante esta inactivo",
      student: attendanceStudent({ estado: EstadoEstudiante.INACTIVO }),
      code: "ESTUDIANTE_INACTIVO",
    },
    {
      escenario: "no existe una inscripcion activa",
      student: attendanceStudent({ conInscripcion: false }),
      code: "INSCRIPCION_ACTIVA_AUSENTE",
    },
    {
      escenario: "el curso no tiene horario activo",
      student: attendanceStudent({ conHorario: false }),
      code: "HORARIO_ACTIVO_AUSENTE",
    },
    {
      escenario: "el periodo no tiene configuracion horaria",
      student: attendanceStudent({ conConfiguracion: false }),
      code: "CONFIGURACION_HORARIA_AUSENTE",
    },
  ])(
    "expone un codigo estable cuando $escenario",
    async ({ student, code }) => {
      const tx = {
        estudiante: { findUnique: jest.fn().mockResolvedValue(student) },
        auditoria: { create: jest.fn().mockResolvedValue({}) },
        asistencia: { findUniqueOrThrow: jest.fn() },
        $queryRaw: jest.fn(),
      };
      const prisma = {
        $transaction: (callback: (client: typeof tx) => unknown) =>
          callback(tx),
      };
      const service = new AttendanceService(prisma as unknown as PrismaService);

      await expect(
        service.registerManual(148, Jornada.MANANA, actor),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code }) });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    },
  );

  it("registra estados y deduplica por estudiante, fecha y jornada seleccionada", async () => {
    const now = new Date();
    const morningAttendance = {
      id: 3,
      fechaHora: now,
      estado: EstadoAsistencia.PUNTUAL,
    };
    const afternoonAttendance = {
      id: 4,
      fechaHora: now,
      estado: EstadoAsistencia.ATRASO,
    };
    const student = attendanceStudent();
    student.inscripciones[0].curso.horarios.push({
      id: 2,
      jornada: Jornada.TARDE,
      horaLimite: new Date("1970-01-01T23:59:00Z"),
      toleranciaMinutos: 0,
      zonaHoraria: "America/La_Paz",
      activo: true,
    });
    const tx = {
      estudiante: { findUnique: jest.fn().mockResolvedValue(student) },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
      asistencia: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(morningAttendance),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([morningAttendance])
        .mockResolvedValueOnce([afternoonAttendance])
        .mockResolvedValueOnce([]),
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const service = new AttendanceService(prisma as unknown as PrismaService);

    const morning = await service.registerManual(148, Jornada.MANANA, actor);
    const afternoon = await service.registerManual(148, Jornada.TARDE, actor);
    const duplicateMorning = await service.registerManual(
      148,
      Jornada.MANANA,
      actor,
    );

    expect(morning.horario.jornada).toBe(Jornada.MANANA);
    expect(afternoon.horario.jornada).toBe(Jornada.TARDE);
    expect(morning.estado).toBe(EstadoAsistencia.PUNTUAL);
    expect(afternoon.estado).toBe(EstadoAsistencia.ATRASO);
    expect(duplicateMorning.duplicado).toBe(true);
    expect(tx.$queryRaw.mock.calls[0][0].values).toContain(1);
    expect(tx.$queryRaw.mock.calls[1][0].values).toContain(2);
    expect(tx.asistencia.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          estudianteId_horarioId_fechaLocal: expect.objectContaining({
            horarioId: 1,
          }),
        },
      }),
    );
  });

  it("rechaza una jornada que el curso no tiene activa", async () => {
    const tx = {
      estudiante: {
        findUnique: jest.fn().mockResolvedValue(attendanceStudent()),
      },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
      asistencia: { findUniqueOrThrow: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const service = new AttendanceService(prisma as unknown as PrismaService);

    await expect(
      service.registerManual(148, Jornada.TARDE, actor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "HORARIO_JORNADA_AUSENTE" }),
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("lista jornadas activas en orden operativo", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { jornada: Jornada.NOCHE },
        { jornada: Jornada.MANANA },
        { jornada: Jornada.TARDE },
      ]);
    const prisma = {
      horarioIngreso: { findMany },
    } as unknown as PrismaService;
    const service = new AttendanceService(prisma);

    await expect(service.availableShifts()).resolves.toEqual([
      { jornada: Jornada.MANANA },
      { jornada: Jornada.TARDE },
      { jornada: Jornada.NOCHE },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ["jornada"] }),
    );
  });

  it("proyecta una fila por jornada y ausencia sin hora ficticia", async () => {
    const date = new Date("2026-08-21T00:00:00.000Z");
    const student = attendanceStudent();
    const enrollment = {
      ...student.inscripciones[0],
      estudiante: {
        id: student.id,
        codigoEstudiante: student.codigoEstudiante,
        nombres: student.nombres,
        apellidos: student.apellidos,
        fotografiaUrl: student.fotografiaUrl,
      },
    };
    enrollment.curso.horarios.push({
      id: 2,
      jornada: Jornada.TARDE,
      horaLimite: new Date("1970-01-01T14:00:00Z"),
      toleranciaMinutos: 0,
      zonaHoraria: "America/La_Paz",
      activo: true,
    });
    const prisma = {
      inscripcion: { findMany: jest.fn().mockResolvedValue([enrollment]) },
      asistencia: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3,
            estudianteId: enrollment.estudianteId,
            cursoId: enrollment.cursoId,
            horarioId: 1,
            fechaLocal: date,
            fechaHora: new Date("2026-08-21T12:00:00.000Z"),
            estado: EstadoAsistencia.PUNTUAL,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new AttendanceService(prisma);

    const rows = await service.daily("2026-08-21", undefined);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      horario: { jornada: Jornada.MANANA },
      estado: EstadoAsistencia.PUNTUAL,
    });
    expect(rows[1]).toMatchObject({
      horario: { jornada: Jornada.TARDE },
      fechaHora: null,
      estado: "AUSENTE",
    });
    expect(prisma.inscripcion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vigenteDesde: { lte: date },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: date } }],
        }),
      }),
    );
  });

  it("no inventa ausencias en sábado", async () => {
    const prisma = {
      inscripcion: { findMany: jest.fn() },
      asistencia: { findMany: jest.fn() },
    } as unknown as PrismaService;

    await expect(
      new AttendanceService(prisma).daily("2026-08-22", undefined),
    ).resolves.toEqual([]);
    expect(prisma.inscripcion.findMany).not.toHaveBeenCalled();
    expect(prisma.asistencia.findMany).not.toHaveBeenCalled();
  });

  it("rechaza una fecha diaria inexistente antes de consultar Prisma", async () => {
    const prisma = {
      inscripcion: { findMany: jest.fn() },
      asistencia: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const service = new AttendanceService(prisma);

    await expect(service.daily("2026-02-31", undefined)).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.inscripcion.findMany).not.toHaveBeenCalled();
    expect(prisma.asistencia.findMany).not.toHaveBeenCalled();
  });
});

function attendanceStudent({
  estado = EstadoEstudiante.ACTIVO,
  conInscripcion = true,
  conHorario = true,
  conConfiguracion = true,
}: {
  estado?: EstadoEstudiante;
  conInscripcion?: boolean;
  conHorario?: boolean;
  conConfiguracion?: boolean;
} = {}) {
  const now = new Date();
  return {
    id: 1,
    codigoEstudiante: 148,
    nombres: "Valeria",
    apellidos: "Mendoza Rojas",
    fotografiaUrl: "/foto.jpg",
    estado,
    inscripciones: conInscripcion
      ? [
          {
            id: 1,
            estudianteId: 1,
            cursoId: 1,
            periodoId: 1,
            estado: EstadoInscripcion.ACTIVA,
            creadoEn: now,
            periodo: {
              estado: EstadoPeriodo.ACTIVO,
              configuracionHorario: conConfiguracion
                ? {
                    toleranciaMinutos: 5,
                    zonaHoraria: "America/La_Paz",
                  }
                : null,
            },
            curso: {
              id: 1,
              nombre: "4.º Secundaria B",
              horarios: conHorario
                ? [
                    {
                      id: 1,
                      jornada: Jornada.MANANA as Jornada,
                      horaLimite: new Date("1970-01-01T23:59:00Z"),
                      toleranciaMinutos: 0,
                      zonaHoraria: "America/La_Paz",
                      activo: true,
                    },
                  ]
                : [],
            },
          },
        ]
      : [],
  };
}
