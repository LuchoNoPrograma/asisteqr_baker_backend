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
      id: 1,
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

  it("prioriza administrador para un usuario multirrol", async () => {
    const password = "contrasena-segura";
    const user = {
      id: 1,
      nombreUsuario: "admin-docente",
      nombreCompleto: "Administrador Docente",
      contrasenaHash: await argon2.hash(password),
      estado: EstadoUsuario.ACTIVO,
      roles: [
        { rol: { codigo: "DOCENTE" } },
        { rol: { codigo: "ADMINISTRADOR" } },
      ],
    };
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue(user) },
      sesion: { create: jest.fn().mockResolvedValue({}) },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn().mockReturnValue("720"),
    } as unknown as ConfigService;
    const service = new AuthService(prisma, config);

    const login = await service.login({
      usuario: user.nombreUsuario,
      contrasena: password,
    });
    const restored = service.current({
      sub: user.id,
      usuario: user.nombreUsuario,
      nombreCompleto: user.nombreCompleto,
      roles: ["DOCENTE", "ADMINISTRADOR"],
      sesionId: 2,
    });

    expect(login.usuario.rol).toBe("ADMINISTRADOR");
    expect(restored.usuario.rol).toBe("ADMINISTRADOR");
  });

  it("expone REGENTE como rol operativo por encima de DOCENTE", () => {
    const prisma = {} as PrismaService;
    const config = {} as ConfigService;
    const service = new AuthService(prisma, config);

    const restored = service.current({
      sub: 3,
      usuario: "regente",
      nombreCompleto: "Regente Baker",
      roles: ["DOCENTE", "REGENTE"],
      sesionId: 4,
    });

    expect(restored.usuario.rol).toBe("REGENTE");
  });
});
