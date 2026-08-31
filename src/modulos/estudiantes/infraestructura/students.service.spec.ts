import {
  EstadoCredencial,
  EstadoEstudiante,
  EstadoInscripcion,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { StudentsService } from "./students.service";

const actor: AuthenticatedUser = {
  sub: 1,
  usuario: "admin",
  nombreCompleto: "Administrador Baker",
  roles: ["ADMINISTRADOR"],
  sesionId: 2,
};

describe("StudentsService", () => {
  it("retira estudiante, matricula y QR en el comando explicito", async () => {
    const tx = studentTransaction();
    const prisma = transactionPrisma(tx);
    const service = new StudentsService(prisma);

    await service.remove(1, actor);

    expect(tx.estudiante.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { estado: EstadoEstudiante.RETIRADO },
    });
    expect(tx.inscripcion.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        estado: EstadoInscripcion.RETIRADA,
        vigenteHasta: expect.any(Date),
      },
    });
    expect(tx.credencialQr.updateMany).toHaveBeenCalledWith({
      where: {
        estudianteId: 1,
        estado: EstadoCredencial.ACTIVA,
      },
      data: { estado: EstadoCredencial.REVOCADA },
    });
    expect(tx.auditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "ESTUDIANTE_RETIRADO" }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("cierra la matrícula anterior y crea otra al cambiar de curso", async () => {
    const tx = {
      estudiante: {
        findUnique: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 1,
          codigoEstudiante: 1,
          numeroDocumento: null,
          nombres: "ANA",
          apellidos: "PEREZ",
          fechaNacimiento: null,
          nombreTutor: null,
          telefonoTutor: null,
          fotografiaUrl: null,
          estado: EstadoEstudiante.ACTIVO,
          inscripciones: [{ curso: { id: 2, nombre: "5.º A" } }],
        }),
      },
      curso: {
        findFirst: jest.fn().mockResolvedValue({ id: 2 }),
      },
      periodoAcademico: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          fechaInicio: new Date("2026-07-01T00:00:00.000Z"),
          fechaFin: new Date("2026-12-15T00:00:00.000Z"),
        }),
      },
      inscripcion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          cursoId: 1,
          vigenteDesde: new Date("2026-07-01T00:00:00.000Z"),
        }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new StudentsService(transactionPrisma(tx));

    await service.update(1, { cursoId: 2 }, actor);

    const closedAt = tx.inscripcion.update.mock.calls[0][0].data.vigenteHasta;
    expect(tx.inscripcion.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        estado: EstadoInscripcion.RETIRADA,
        vigenteHasta: expect.any(Date),
      },
    });
    expect(tx.inscripcion.create).toHaveBeenCalledWith({
      data: {
        estudianteId: 1,
        periodoId: 1,
        cursoId: 2,
        vigenteDesde: closedAt,
      },
    });
  });
});

function studentTransaction() {
  return {
    estudiante: {
      findUnique: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    inscripcion: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          vigenteDesde: new Date("2026-07-01T00:00:00.000Z"),
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
    },
    credencialQr: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditoria: { create: jest.fn().mockResolvedValue({}) },
  };
}

function transactionPrisma<T>(tx: T) {
  return {
    $transaction: jest.fn((callback: (client: T) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService & { $transaction: jest.Mock };
}
