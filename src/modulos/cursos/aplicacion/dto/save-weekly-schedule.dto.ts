import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class WeeklyScheduleCellDto {
  @IsInt()
  @Min(1)
  @Max(5)
  diaSemana: number;

  @IsInt()
  @Min(8)
  @Max(19)
  hora: number;
}

export class SaveWeeklyScheduleDto {
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => WeeklyScheduleCellDto)
  celdas: WeeklyScheduleCellDto[];
}
