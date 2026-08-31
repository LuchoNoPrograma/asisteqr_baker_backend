import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDivisibleBy,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class SchedulePlannerAssignmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursoId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  materiaId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  docenteId: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(2400)
  @IsDivisibleBy(30)
  minutosSemanales?: number;
}

export class SchedulePlannerBlockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursoId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  materiaId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  docenteId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  aulaId: number;

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

export class SaveSchedulePlannerDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodoId: number;

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
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  asignacionesEliminadas: number[];

  @IsArray()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  bloquesEliminados: number[];
}
