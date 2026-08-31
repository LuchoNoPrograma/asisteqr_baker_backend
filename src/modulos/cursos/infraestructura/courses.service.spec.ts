import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CoursesService } from "./courses.service";

const actor: AuthenticatedUser = {
  sub: 1,
  usuario: "admin",
  nombreCompleto: "Administrador Baker",
  roles: ["ADMINISTRADOR"],
  sesionId: 2,
};

describe("CoursesService", () => {
  it("deriva los docentes únicos de las asignaciones académicas activas", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        nombre: "4.º Secundaria B",
        nivel: "4.º Secundaria",
        paralelo: "B",
        gestion: 2026,
        activo: true,
        _count: { inscripciones: 31 },
        asignacionesAcademicas: [
          { docenteId: 1 },
          { docenteId: 1 },
          { docenteId: 2 },
        ],
        horarios: [],
      },
    ]);
    const prisma = { curso: { findMany } } as unknown as PrismaService;

    const result = await new CoursesService(prisma).list();

    expect(result[0]).toMatchObject({
      cantidadEstudiantes: 31,
      cantidadDocentes: 2,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          asignacionesAcademicas: expect.objectContaining({
            select: { docenteId: true },
          }),
        }),
      }),
    );
  });

  it("rechaza la baja con 409 cuando existen dependencias activas", async () => {
    const tx = courseTransaction(4, 2, 5);
    const service = new CoursesService(transactionPrisma(tx));

    await expect(service.remove(1, actor)).rejects.toMatchObject({
      status: 409,
      response: {
        code: "CURSO_CON_DEPENDENCIAS_ACTIVAS",
        dependencies: {
          inscripcionesActivas: 4,
          asignacionesActivas: 2,
          bloquesActivos: 5,
        },
      },
    });

    expect(tx.curso.update).not.toHaveBeenCalled();
    expect(tx.horarioIngreso.updateMany).not.toHaveBeenCalled();
    expect(tx.auditoria.create).not.toHaveBeenCalled();
  });

  it("inactiva curso y horarios cuando no existen dependencias activas", async () => {
    const tx = courseTransaction(0, 0, 0);
    const prisma = transactionPrisma(tx);
    const service = new CoursesService(prisma);

    await service.remove(1, actor);

    expect(tx.curso.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { activo: false },
    });
    expect(tx.horarioIngreso.updateMany).toHaveBeenCalledWith({
      where: { cursoId: 1, activo: true },
      data: { activo: false, vigenteHasta: expect.any(Date) },
    });
    expect(tx.auditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "CURSO_INACTIVADO" }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
});

function courseTransaction(
  activeEnrollments: number,
  activeAssignments: number,
  activeBlocks: number,
) {
  return {
    curso: {
      findUnique: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    inscripcion: { count: jest.fn().mockResolvedValue(activeEnrollments) },
    asignacionAcademica: {
      count: jest.fn().mockResolvedValue(activeAssignments),
    },
    horarioClase: { count: jest.fn().mockResolvedValue(activeBlocks) },
    horarioIngreso: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditoria: { create: jest.fn().mockResolvedValue({}) },
  };
}

function transactionPrisma(tx: ReturnType<typeof courseTransaction>) {
  return {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService & { $transaction: jest.Mock };
}
