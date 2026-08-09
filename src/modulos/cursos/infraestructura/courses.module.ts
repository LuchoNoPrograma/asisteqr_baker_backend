import { Module } from "@nestjs/common";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { AuthModule } from "../../autenticacion/infraestructura/auth.module";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";

@Module({
  imports: [AuthModule],
  controllers: [CoursesController],
  providers: [RolesGuard, CoursesService],
})
export class CoursesModule {}
