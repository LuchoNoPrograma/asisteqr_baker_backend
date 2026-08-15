import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { EstadoUsuario } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      header(name: string): string | undefined;
      user?: AuthenticatedUser;
    }>();
    const token = request
      .header("authorization")
      ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) throw new UnauthorizedException("Debes iniciar sesión");

    const session = await this.prisma.sesion.findUnique({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      include: { usuario: { include: { roles: { include: { rol: true } } } } },
    });
    if (
      !session ||
      session.revocadaEn ||
      session.expiraEn <= new Date() ||
      session.usuario.estado !== EstadoUsuario.ACTIVO
    ) {
      throw new UnauthorizedException("Sesión vencida o revocada");
    }

    request.user = {
      sub: session.usuario.id,
      usuario: session.usuario.nombreUsuario,
      nombreCompleto: session.usuario.nombreCompleto,
      roles: session.usuario.roles.map(({ rol }) => rol.codigo),
      sesionId: session.id,
    };
    return true;
  }
}
