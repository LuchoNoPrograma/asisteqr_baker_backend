import { Module } from "@nestjs/common";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { AuthModule } from "../../autenticacion/infraestructura/auth.module";
import { TeachingSchedulesController } from "./teaching-schedules.controller";
import { TeachingSchedulesService } from "./teaching-schedules.service";

@Module({
  imports: [AuthModule],
  controllers: [TeachingSchedulesController],
  providers: [RolesGuard, TeachingSchedulesService],
})
export class TeachingSchedulesModule {}
