import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class GeneralBreakDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaInicio: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaFin: string;
}

export class SaveGeneralScheduleConfigDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodoId: number;

  @IsInt()
  @Min(0)
  version: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaInicio: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaFin: string;

  @IsInt()
  @Min(30)
  @Max(30)
  intervaloMinutos: number;

  @IsInt()
  @Min(0)
  @Max(120)
  toleranciaMinutos: number;

  @IsString()
  @MaxLength(80)
  zonaHoraria: string;

  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => GeneralBreakDto)
  recreos: GeneralBreakDto[];
}
