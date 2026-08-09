import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnvironment } from "./comun/configuracion/environment";
import { PrismaModule } from "./comun/prisma/prisma.module";
import { AuthModule } from "./modulos/autenticacion/infraestructura/auth.module";
import { AttendanceModule } from "./modulos/asistencias/infraestructura/attendance.module";
import { CoursesModule } from "./modulos/cursos/infraestructura/courses.module";
import { CredentialsModule } from "./modulos/credenciales/infraestructura/credentials.module";
import { TeachersModule } from "./modulos/docentes/infraestructura/teachers.module";
import { StudentsModule } from "./modulos/estudiantes/infraestructura/students.module";
import { PeriodsModule } from "./modulos/periodos/infraestructura/periods.module";
import { ReportsModule } from "./modulos/reportes/infraestructura/reports.module";
import { TeachingSchedulesModule } from "./modulos/horarios/infraestructura/teaching-schedules.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    AttendanceModule,
    CoursesModule,
    CredentialsModule,
    StudentsModule,
    TeachersModule,
    PeriodsModule,
    ReportsModule,
    TeachingSchedulesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
