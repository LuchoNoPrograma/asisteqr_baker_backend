import { createHash, randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { EstadoUsuario } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { LoginDto } from "../aplicacion/dto/login.dto";

export interface TokenPair {
  tokenAcceso: string;
  tokenRenovacion: string;
  usuario: { id: string; usuario: string; nombreCompleto: string; rol: string };
}

interface RefreshPayload {
  sub: string;
  usuario: string;
  roles: string[];
  sesionId: string;
  tipo: "renovacion";
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, direccionIp?: string): Promise<TokenPair> {
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
    const pair = await this.createTokenPair(
      user.id,
      user.nombreUsuario,
      user.nombreCompleto,
      roles,
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
    return pair;
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Token de renovación inválido");
    }
    const session = await this.prisma.sesion.findFirst({
      where: {
        id: payload.sesionId,
        usuarioId: payload.sub,
        revocadaEn: null,
        expiraEn: { gt: new Date() },
      },
      include: { usuario: { include: { roles: { include: { rol: true } } } } },
    });
    if (!session || this.hash(refreshToken) !== session.tokenHash)
      throw new UnauthorizedException("Sesión no válida");
    await this.prisma.sesion.update({
      where: { id: session.id },
      data: { revocadaEn: new Date() },
    });
    return this.createTokenPair(
      session.usuario.id,
      session.usuario.nombreUsuario,
      session.usuario.nombreCompleto,
      session.usuario.roles.map(({ rol }) => rol.codigo),
      session.dispositivo ?? undefined,
      session.direccionIp ?? undefined,
    );
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

  private async createTokenPair(
    userId: string,
    nombreUsuario: string,
    nombreCompleto: string,
    roles: string[],
    dispositivo?: string,
    direccionIp?: string,
  ): Promise<TokenPair> {
    const sesionId = randomUUID();
    const accessPayload: AuthenticatedUser = {
      sub: userId,
      usuario: nombreUsuario,
      roles,
      sesionId,
      tipo: "acceso",
    };
    const refreshPayload = { ...accessPayload, tipo: "renovacion" as const };
    const [tokenAcceso, tokenRenovacion] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.ttlSeconds(
          this.config.get<string>("JWT_ACCESS_TTL"),
          900,
        ),
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.ttlSeconds(
          this.config.get<string>("JWT_REFRESH_TTL"),
          2_592_000,
        ),
      }),
    ]);
    const decoded = this.jwt.decode(tokenRenovacion) as { exp: number };
    await this.prisma.sesion.create({
      data: {
        id: sesionId,
        usuarioId: userId,
        tokenHash: this.hash(tokenRenovacion),
        dispositivo,
        direccionIp,
        expiraEn: new Date(decoded.exp * 1000),
      },
    });
    return {
      tokenAcceso,
      tokenRenovacion,
      usuario: {
        id: userId,
        usuario: nombreUsuario,
        nombreCompleto,
        rol: roles[0] ?? "DOCENTE",
      },
    };
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private ttlSeconds(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return fallback;
    const amount = Number(match[1]);
    const multiplier = { s: 1, m: 60, h: 3600, d: 86_400 }[match[2]] ?? 1;
    return amount * multiplier;
  }
}
