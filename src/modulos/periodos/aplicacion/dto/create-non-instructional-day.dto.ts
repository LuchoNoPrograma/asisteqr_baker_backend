import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { NormalizePlainText } from "../../../../comun/validacion/person-fields";

export class CreateNonInstructionalDayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "La fecha debe tener formato AAAA-MM-DD",
  })
  fecha: string;

  @IsString()
  @NormalizePlainText()
  @MinLength(2)
  @MaxLength(180)
  descripcion: string;
}
