import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class TeacherScheduleBlockDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsUUID()
  cursoId: string;

  @IsUUID()
  materiaId: string;

  @IsUUID()
  aulaId: string;

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

export class SaveTeacherScheduleMatrixDto {
  @IsUUID()
  periodoId: string;

  @IsInt()
  @Min(1)
  version: number;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TeacherScheduleBlockDto)
  bloques: TeacherScheduleBlockDto[];
}
