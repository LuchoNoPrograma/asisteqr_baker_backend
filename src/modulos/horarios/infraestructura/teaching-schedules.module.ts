import { Module } from "@nestjs/common";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { AuthModule } from "../../autenticacion/infraestructura/auth.module";
import { TeachingSchedulesController } from "./teaching-schedules.controller";
import { TeachingSchedulesService } from "./teaching-schedules.service";
import { ScheduleCatalogsController } from "./schedule-catalogs.controller";
import { ScheduleCatalogsService } from "./schedule-catalogs.service";

@Module({
  imports: [AuthModule],
  controllers: [TeachingSchedulesController, ScheduleCatalogsController],
  providers: [RolesGuard, TeachingSchedulesService, ScheduleCatalogsService],
})
export class TeachingSchedulesModule {}
