import { Module } from "@nestjs/common";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { AuthModule } from "../../autenticacion/infraestructura/auth.module";
import { CredentialsController } from "./credentials.controller";
import { CredentialsService } from "./credentials.service";

@Module({
  imports: [AuthModule],
  controllers: [CredentialsController],
  providers: [CredentialsService, RolesGuard],
})
export class CredentialsModule {}
