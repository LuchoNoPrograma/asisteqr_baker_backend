import { Jornada } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class SaveScheduleDto {
  @IsEnum(Jornada)
  jornada: Jornada;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaLimite: string;

  @IsInt()
  @Min(0)
  @Max(120)
  toleranciaMinutos: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  zonaHoraria?: string;
}
