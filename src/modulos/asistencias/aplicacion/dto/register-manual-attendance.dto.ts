import { IsInt, Min } from "class-validator";

export class RegisterManualAttendanceDto {
  @IsInt()
  @Min(1)
  codigoEstudiante: number;
}
