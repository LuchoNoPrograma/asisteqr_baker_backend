import { EstadoEstudiante } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { CredentialsService } from "./credentials.service";

describe("CredentialsService", () => {
  it("crea una credencial una vez y conserva el mismo QR al reimprimir", async () => {
    const student = {
      id: 1,
      codigoEstudiante: 1,
      nombres: "VALERIA",
      apellidos: "MENDOZA ROJAS",
      nombreTutor: "ANA ROJAS",
      telefonoTutor: "71234567",
      fotografiaUrl: "/foto.jpg",
      estado: EstadoEstudiante.ACTIVO,
      inscripciones: [
        {
          curso: {
            id: 1,
            nombre: "4.º Secundaria B",
            gestion: 2026,
          },
        },
      ],
    };
    const credential = {
      id: 1,
      estudianteId: student.id,
    };
    const findCredentials = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([credential])
      .mockResolvedValueOnce([credential]);
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      estudiante: { findMany: jest.fn().mockResolvedValue([student]) },
      credencialQr: { findMany: findCredentials, createMany },
    } as unknown as PrismaService;
    const service = new CredentialsService(prisma);

    const first = await service.printable();
    const reprint = await service.printable();

    expect(first[0].tokenQr).toBe("AQB1.v1_1");
    expect(reprint[0].tokenQr).toBe(first[0].tokenQr);
    expect(first[0].estudiante.nombreCompleto).toBe("VALERIA MENDOZA ROJAS");
    expect(first[0].estudiante.nombreTutor).toBe("ANA ROJAS");
    expect(first[0].estudiante.telefonoTutor).toBe("71234567");
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          estudianteId: student.id,
          esPrincipal: true,
          version: 3,
          estado: "ACTIVA",
        },
      ],
      skipDuplicates: true,
    });
  });
});
