import {
  IsInt,
  Matches,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  NormalizePlainText,
  NormalizeText,
} from "../../../../comun/validacion/person-fields";

export class CreateCourseDto {
  @IsString()
  @NormalizePlainText()
  @MinLength(2)
  @MaxLength(100)
  nombre: string;

  @IsString()
  @NormalizePlainText()
  @Matches(/^[1-6]\.º Secundaria$/i, {
    message: "El nivel debe corresponder a secundaria",
  })
  @MinLength(2)
  @MaxLength(60)
  nivel: string;

  @IsString()
  @NormalizeText()
  @MinLength(1)
  @MaxLength(10)
  paralelo: string;

  @IsInt()
  @Min(2020)
  @Max(2100)
  gestion: number;
}
