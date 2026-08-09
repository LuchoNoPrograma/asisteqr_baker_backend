import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "./authenticated-user";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser; ip?: string }>();
    const allowed = required.some((role) => request.user.roles.includes(role));
    if (allowed) return true;

    await this.prisma.auditoria
      .create({
        data: {
          usuarioId: request.user.sub,
          accion: "ACCESO_DENEGADO",
          recurso: `${context.getClass().name}.${context.getHandler().name}`,
          metadatos: { rolesRequeridos: required },
          direccionIp: request.ip,
        },
      })
      .catch(() => undefined);
    return false;
  }
}
