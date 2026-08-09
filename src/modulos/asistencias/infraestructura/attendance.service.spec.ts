import {
  EstadoAsistencia,
  EstadoCredencial,
  EstadoEstudiante,
  EstadoInscripcion,
  EstadoPeriodo,
  Jornada,
} from "@prisma/client";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { AttendanceService } from "./attendance.service";

const actor: AuthenticatedUser = {
  sub: "10000000-0000-4000-8000-000000000099",
  usuario: "docente",
  roles: ["DOCENTE"],
  sesionId: "10000000-0000-4000-8000-000000000098",
  tipo: "acceso",
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
      service.scan("QR-NO-REGISTRADO", actor),
    ).rejects.toBeInstanceOf(NotFoundException);
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
        id: "20000000-0000-4000-8000-000000000001",
        codigoEstudiante: 1,
        nombres: "Valeria",
        apellidos: "Mendoza Rojas",
        fotografiaUrl: "/foto.jpg",
        estado: EstadoEstudiante.ACTIVO,
        inscripciones: [
          {
            id: "inscripcion",
            estudianteId: "20000000-0000-4000-8000-000000000001",
            cursoId: "30000000-0000-4000-8000-000000000001",
            periodoId: "periodo",
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
              id: "30000000-0000-4000-8000-000000000001",
              nombre: "4.º Secundaria B",
              horarios: [
                {
                  id: "horario",
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
      id: "asistencia-1",
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

    const result = await service.scan("AQB1.v2_8fK4mQ7xN2cR9pL6sT3w", actor);

    expect(result.duplicado).toBe(false);
    expect(result.estudiante.nombreCompleto).toBe("Valeria Mendoza Rojas");
    expect(result.estudiante.curso).toBe("4.º Secundaria B");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
