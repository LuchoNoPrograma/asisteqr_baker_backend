import {
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class SaveTeachingScheduleDto {
  @IsUUID()
  docenteId: string;

  @IsUUID()
  cursoId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  materia: string;

  @IsInt()
  @Min(1)
  @Max(5)
  diaSemana: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaInicio: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaFin: string;
}
