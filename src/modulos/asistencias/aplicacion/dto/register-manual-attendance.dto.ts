import { Jornada } from "@prisma/client";
import { IsEnum, IsInt, Min } from "class-validator";

export class RegisterManualAttendanceDto {
  @IsInt()
  @Min(1)
  codigoEstudiante: number;

  @IsEnum(Jornada)
  jornada: Jornada;
}
