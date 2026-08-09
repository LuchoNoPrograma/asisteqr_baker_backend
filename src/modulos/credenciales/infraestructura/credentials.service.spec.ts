import { ConfigService } from "@nestjs/config";
import { EstadoCredencial, EstadoEstudiante } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { CredentialsService } from "./credentials.service";

describe("CredentialsService", () => {
  it("prepara tokens validos sin almacenar el valor QR en texto plano", async () => {
    const student = {
      id: "20000000-0000-4000-8000-000000000001",
      codigoEstudiante: 1,
      nombres: "VALERIA",
      apellidos: "MENDOZA ROJAS",
      fotografiaUrl: "/foto.jpg",
      estado: EstadoEstudiante.ACTIVO,
      inscripciones: [
        {
          curso: {
            id: "30000000-0000-4000-8000-000000000001",
            nombre: "4.º Secundaria B",
            gestion: 2026,
          },
        },
      ],
    };
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      estudiante: { findMany: jest.fn().mockResolvedValue([student]) },
      credencialQr: { upsert },
      $transaction: (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
    } as unknown as PrismaService;
    const config = {
      getOrThrow: jest
        .fn()
        .mockReturnValue("qr-secret-with-at-least-32-characters"),
    } as unknown as ConfigService;

    const result = await new CredentialsService(prisma, config).printable();

    expect(result).toHaveLength(1);
    expect(result[0].tokenQr).toMatch(/^AQB1\.v2_[A-Za-z0-9_-]{43}$/);
    expect(result[0].estudiante.nombreCompleto).toBe("VALERIA MENDOZA ROJAS");
    const tokenHash = createHash("sha256")
      .update(result[0].tokenQr)
      .digest("hex");
    expect(upsert).toHaveBeenCalledWith({
      where: { tokenHash },
      update: {
        estudianteId: student.id,
        estado: EstadoCredencial.ACTIVA,
        vigenteHasta: null,
      },
      create: {
        estudianteId: student.id,
        tokenHash,
        version: 2,
        estado: EstadoCredencial.ACTIVA,
      },
    });
    expect(JSON.stringify(upsert.mock.calls)).not.toContain(result[0].tokenQr);
  });
});
