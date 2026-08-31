import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { PeriodsService } from "./periods.service";

const actor: AuthenticatedUser = {
  sub: 1,
  usuario: "admin",
  nombreCompleto: "Administrador Baker",
  roles: ["ADMINISTRADOR"],
  sesionId: 2,
};

describe("PeriodsService", () => {
  it("registra y audita un día no lectivo dentro del periodo", async () => {
    const tx = {
      diaNoLectivo: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          periodoId: 1,
          fecha: new Date("2026-08-05T00:00:00.000Z"),
          descripcion: "Feriado local",
        }),
      },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      periodoAcademico: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          fechaInicio: new Date("2026-07-01T00:00:00.000Z"),
          fechaFin: new Date("2026-12-15T00:00:00.000Z"),
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    const result = await new PeriodsService(prisma).createNonInstructionalDay(
      1,
      { fecha: "2026-08-05", descripcion: "Feriado local" },
      actor,
    );

    expect(result).toEqual({
      id: 1,
      periodoId: 1,
      fecha: "2026-08-05",
      descripcion: "Feriado local",
    });
    expect(tx.auditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "DIA_NO_LECTIVO_CREADO" }),
      }),
    );
  });

  it("rechaza fines de semana porque ya están excluidos del calendario", async () => {
    const transaction = jest.fn();
    const prisma = {
      periodoAcademico: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          fechaInicio: new Date("2026-07-01T00:00:00.000Z"),
          fechaFin: new Date("2026-12-15T00:00:00.000Z"),
        }),
      },
      $transaction: transaction,
    } as unknown as PrismaService;

    await expect(
      new PeriodsService(prisma).createNonInstructionalDay(
        1,
        { fecha: "2026-08-08", descripcion: "Sábado" },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
