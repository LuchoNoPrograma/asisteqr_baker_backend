import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: AuthenticatedUser): Promise<AuthenticatedUser> {
    if (payload.tipo !== "acceso")
      throw new UnauthorizedException("Tipo de token inválido");
    const session = await this.prisma.sesion.findFirst({
      where: {
        id: payload.sesionId,
        usuarioId: payload.sub,
        revocadaEn: null,
        expiraEn: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) throw new UnauthorizedException("Sesión vencida o revocada");
    return payload;
  }
}
