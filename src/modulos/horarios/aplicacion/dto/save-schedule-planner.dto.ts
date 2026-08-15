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

export class SchedulePlannerAssignmentDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  cursoId: string;

  @IsUUID()
  materiaId: string;

  @IsUUID()
  docenteId: string;

  @IsOptional()
  @IsInt()
  minutosSemanales?: number;
}

export class SchedulePlannerBlockDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  cursoId: string;

  @IsUUID()
  materiaId: string;

  @IsUUID()
  docenteId: string;

  @IsUUID()
  aulaId: string;

  @IsInt()
  @Min(1)
  @Max(7)
  diaSemana: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaInicio: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaFin: string;
}

export class SaveSchedulePlannerDto {
  @IsUUID()
  periodoId: string;

  @IsInt()
  @Min(1)
  version: number;

  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => SchedulePlannerAssignmentDto)
  asignaciones: SchedulePlannerAssignmentDto[];

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => SchedulePlannerBlockDto)
  bloques: SchedulePlannerBlockDto[];

  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID(undefined, { each: true })
  asignacionesEliminadas: string[];

  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  bloquesEliminados: string[];
}
