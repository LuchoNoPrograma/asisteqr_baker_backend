import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EstadoUsuario } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { LoginDto } from "../aplicacion/dto/login.dto";

export interface SessionResponse {
  token: string;
  expiraEn: string;
  usuario: { id: number; usuario: string; nombreCompleto: string; rol: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, direccionIp?: string): Promise<SessionResponse> {
    const user = await this.prisma.usuario.findUnique({
      where: { nombreUsuario: dto.usuario.toLowerCase() },
      include: { roles: { include: { rol: true } } },
    });
    const valid =
      user &&
      user.estado === EstadoUsuario.ACTIVO &&
      (await argon2.verify(user.contrasenaHash, dto.contrasena));
    if (!valid) {
      await this.prisma.auditoria.create({
        data: {
          accion: "LOGIN_FALLIDO",
          recurso: "autenticacion",
          metadatos: { usuario: dto.usuario.toLowerCase() },
          direccionIp,
        },
      });
      throw new UnauthorizedException("Usuario o contraseña incorrectos");
    }

    const roles = user.roles.map(({ rol }) => rol.codigo);
    const session = await this.createSession(
      user.id,
      dto.dispositivo,
      direccionIp,
    );
    await this.prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        accion: "LOGIN_EXITOSO",
        recurso: "autenticacion",
        direccionIp,
      },
    });
    return {
      ...session,
      usuario: this.userResponse(
        user.id,
        user.nombreUsuario,
        user.nombreCompleto,
        roles,
      ),
    };
  }

  current(user: AuthenticatedUser) {
    return {
      usuario: this.userResponse(
        user.sub,
        user.usuario,
        user.nombreCompleto,
        user.roles,
      ),
    };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.sesion.updateMany({
        where: { id: user.sesionId, usuarioId: user.sub, revocadaEn: null },
        data: { revocadaEn: new Date() },
      }),
      this.prisma.auditoria.create({
        data: {
          usuarioId: user.sub,
          accion: "LOGOUT",
          recurso: "autenticacion",
        },
      }),
    ]);
  }

  private async createSession(
    userId: number,
    dispositivo?: string,
    direccionIp?: string,
  ): Promise<{ token: string; expiraEn: string }> {
    const token = randomBytes(32).toString("base64url");
    const ttlHours = Number(
      this.config.get<string>("SESSION_TTL_HOURS", "720"),
    );
    const expiraEn = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await this.prisma.sesion.create({
      data: {
        usuarioId: userId,
        tokenHash: this.hash(token),
        dispositivo,
        direccionIp,
        expiraEn,
      },
    });
    return { token, expiraEn: expiraEn.toISOString() };
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private userResponse(
    id: number,
    usuario: string,
    nombreCompleto: string,
    roles: string[],
  ) {
    return {
      id,
      usuario,
      nombreCompleto,
      rol: this.primaryRole(roles),
    };
  }

  private primaryRole(roles: string[]): string {
    if (roles.includes("ADMINISTRADOR")) return "ADMINISTRADOR";
    if (roles.includes("REGENTE")) return "REGENTE";
    if (roles.includes("DOCENTE")) return "DOCENTE";
    return roles.toSorted()[0] ?? "DOCENTE";
  }
}
