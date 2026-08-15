import { ConfigService } from "@nestjs/config";
import { EstadoUsuario } from "@prisma/client";
import * as argon2 from "argon2";
import { createHash } from "node:crypto";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("crea una sesion opaca revocable y guarda solo el hash", async () => {
    const password = "contrasena-segura";
    const user = {
      id: "10000000-0000-4000-8000-000000000001",
      nombreUsuario: "admin",
      nombreCompleto: "Administrador Baker",
      contrasenaHash: await argon2.hash(password),
      estado: EstadoUsuario.ACTIVO,
      roles: [{ rol: { codigo: "ADMINISTRADOR" } }],
    };
    const createSession = jest.fn().mockResolvedValue({});
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue(user) },
      sesion: { create: createSession },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn().mockReturnValue("720"),
    } as unknown as ConfigService;

    const result = await new AuthService(prisma, config).login({
      usuario: "admin",
      contrasena: password,
    });

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.usuario.rol).toBe("ADMINISTRADOR");
    expect(createSession).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: user.id,
        tokenHash: createHash("sha256").update(result.token).digest("hex"),
        expiraEn: expect.any(Date),
      }),
    });
    expect(JSON.stringify(createSession.mock.calls)).not.toContain(
      result.token,
    );
  });
});
