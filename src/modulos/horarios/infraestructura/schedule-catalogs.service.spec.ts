import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { ScheduleCatalogsService } from "./schedule-catalogs.service";

const actor: AuthenticatedUser = {
  sub: "10000000-0000-4000-8000-000000000001",
  usuario: "admin",
  nombreCompleto: "Administrador Baker",
  roles: ["ADMINISTRADOR"],
  sesionId: "session-1",
};

describe("ScheduleCatalogsService", () => {
  it("crea un aula identificada únicamente por su nombre", async () => {
    const create = jest.fn().mockResolvedValue({
      id: "30000000-0000-4000-8000-000000000001",
      nombre: "Aula Norte",
      capacidad: 30,
      ubicacion: null,
      activo: true,
    });
    const tx = {
      aula: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as unknown as PrismaService;

    await new ScheduleCatalogsService(prisma).saveClassroom(
      { nombre: " Aula Norte ", capacidad: 30 },
      actor,
    );

    expect(tx.aula.findFirst).toHaveBeenCalledWith({
      where: {
        id: undefined,
        nombre: { equals: "Aula Norte", mode: "insensitive" },
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        nombre: "Aula Norte",
        capacidad: 30,
        ubicacion: null,
      },
    });
    expect(create.mock.calls[0][0].data).not.toHaveProperty("codigo");
  });

  it("no desactiva una materia usada por la carga académica", async () => {
    const updateMany = jest.fn();
    const tx = {
      asignacionAcademica: { count: jest.fn().mockResolvedValue(1) },
      horarioClase: { count: jest.fn().mockResolvedValue(0) },
      materia: { updateMany },
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as unknown as PrismaService;

    await expect(
      new ScheduleCatalogsService(prisma).deactivateSubject(
        "20000000-0000-4000-8000-000000000001",
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("no desactiva un aula con clases activas", async () => {
    const updateMany = jest.fn();
    const tx = {
      horarioClase: { count: jest.fn().mockResolvedValue(1) },
      aula: { updateMany },
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as unknown as PrismaService;

    await expect(
      new ScheduleCatalogsService(prisma).deactivateClassroom(
        "30000000-0000-4000-8000-000000000001",
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
