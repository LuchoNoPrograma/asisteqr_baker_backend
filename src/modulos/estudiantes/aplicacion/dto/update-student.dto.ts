import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from "class-validator";
import {
  DOCUMENT_PATTERN,
  NormalizeText,
  PERSON_NAME_PATTERN,
  PHONE_PATTERN,
  PHOTO_SOURCE_PATTERN,
} from "../../../../comun/validacion/person-fields";

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @NormalizeText()
  @Matches(PERSON_NAME_PATTERN, { message: "Los nombres solo admiten letras" })
  @MinLength(2)
  @MaxLength(100)
  nombres?: string;

  @IsOptional()
  @IsString()
  @NormalizeText()
  @Matches(PERSON_NAME_PATTERN, {
    message: "Los apellidos solo admiten letras",
  })
  @MinLength(2)
  @MaxLength(120)
  apellidos?: string;

  @IsOptional()
  @IsString()
  @NormalizeText()
  @Matches(DOCUMENT_PATTERN, { message: "Documento no válido" })
  @MaxLength(30)
  numeroDocumento?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  @NormalizeText()
  @Matches(PERSON_NAME_PATTERN, {
    message: "El nombre del tutor solo admite letras",
  })
  @MinLength(2)
  @MaxLength(180)
  nombreTutor?: string;

  @IsOptional()
  @IsString()
  @NormalizeText()
  @Matches(PHONE_PATTERN, { message: "Teléfono del tutor no válido" })
  @MaxLength(30)
  telefonoTutor?: string;

  @IsOptional()
  @IsString()
  @Matches(PHOTO_SOURCE_PATTERN, { message: "Formato de fotografía no válido" })
  @MaxLength(800000)
  fotografiaUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursoId?: number;
}
