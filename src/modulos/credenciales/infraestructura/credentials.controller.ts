import { Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { JwtAuthGuard } from "../../autenticacion/infraestructura/jwt-auth.guard";
import { CredentialsService } from "./credentials.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR")
@Controller("credenciales")
export class CredentialsController {
  constructor(private readonly service: CredentialsService) {}

  @Post("imprimibles")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  printable() {
    return this.service.printable();
  }
}
