import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { EstadoUsuario } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { SessionAuthGuard } from "./session-auth.guard";

describe("SessionAuthGuard", () => {
  it("resuelve el actor desde una sesion activa", async () => {
    const request = {
      header: jest
        .fn()
        .mockReturnValue("Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
      user: undefined,
    };
    const prisma = {
      sesion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "sesion-1",
          revocadaEn: null,
          expiraEn: new Date(Date.now() + 60_000),
          usuario: {
            id: "usuario-1",
            nombreUsuario: "docente",
            nombreCompleto: "Docente Baker",
            estado: EstadoUsuario.ACTIVO,
            roles: [{ rol: { codigo: "DOCENTE" } }],
          },
        }),
      },
    } as unknown as PrismaService;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(
      new SessionAuthGuard(prisma).canActivate(context),
    ).resolves.toBe(true);
    expect(request.user).toEqual({
      sub: "usuario-1",
      usuario: "docente",
      nombreCompleto: "Docente Baker",
      roles: ["DOCENTE"],
      sesionId: "sesion-1",
    });
  });

  it("rechaza un bearer que no sea una sesion opaca valida", async () => {
    const request = {
      header: jest.fn().mockReturnValue("Bearer jwt.invalido"),
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(
      new SessionAuthGuard({} as PrismaService).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
