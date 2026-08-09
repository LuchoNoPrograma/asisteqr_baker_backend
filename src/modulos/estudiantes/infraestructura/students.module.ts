import { Module } from "@nestjs/common";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { AuthModule } from "../../autenticacion/infraestructura/auth.module";
import { StudentsController } from "./students.controller";
import { StudentsService } from "./students.service";

@Module({
  imports: [AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService, RolesGuard],
})
export class StudentsModule {}
