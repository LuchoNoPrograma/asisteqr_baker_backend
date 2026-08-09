import { Module } from "@nestjs/common";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import { AuthModule } from "../../autenticacion/infraestructura/auth.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, RolesGuard],
  exports: [AttendanceService],
})
export class AttendanceModule {}
