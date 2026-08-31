import { EstadoDocente, Prisma } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { TeachersService } from "./teachers.service";

const actor: AuthenticatedUser = {
  sub: 1,
  usuario: "admin",
  nombreCompleto: "Administrador Baker",
  roles: ["ADMINISTRADOR"],
  sesionId: 2,
};

describe("TeachersService", () => {
  it("rechaza la baja con 409 cuando existe planificacion activa", async () => {
    const tx = teacherTransaction(2, 3);
    const service = new TeachersService(transactionPrisma(tx));

    await expect(service.remove(1, actor)).rejects.toMatchObject({
      status: 409,
      response: {
        code: "DOCENTE_CON_PLANIFICACION_ACTIVA",
        dependencies: { asignacionesActivas: 2, bloquesActivos: 3 },
      },
    });

    expect(tx.docente.update).not.toHaveBeenCalled();
    expect(tx.auditoria.create).not.toHaveBeenCalled();
  });

  it("inactiva al docente cuando no existen referencias activas", async () => {
    const tx = teacherTransaction(0, 0);
    const prisma = transactionPrisma(tx);
    const service = new TeachersService(prisma);

    await service.remove(1, actor);

    expect(tx.docente.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        estado: EstadoDocente.INACTIVO,
        actualizadoPor: actor.sub,
      },
    });
    expect(tx.auditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "DOCENTE_INACTIVADO" }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
});

function teacherTransaction(activeAssignments: number, activeBlocks: number) {
  return {
    docente: {
      findUnique: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    asignacionAcademica: {
      count: jest.fn().mockResolvedValue(activeAssignments),
    },
    horarioClase: { count: jest.fn().mockResolvedValue(activeBlocks) },
    auditoria: { create: jest.fn().mockResolvedValue({}) },
  };
}

function transactionPrisma(tx: ReturnType<typeof teacherTransaction>) {
  return {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService & { $transaction: jest.Mock };
}
