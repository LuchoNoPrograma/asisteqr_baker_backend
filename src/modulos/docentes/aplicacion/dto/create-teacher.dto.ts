import {
  IsEmail,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  DOCUMENT_PATTERN,
  NormalizeLowerText,
  NormalizeText,
  PERSON_NAME_PATTERN,
  PHONE_PATTERN,
  PHOTO_SOURCE_PATTERN,
} from "../../../../comun/validacion/person-fields";

export class CreateTeacherDto {
  @IsString()
  @NormalizeText()
  @Matches(PERSON_NAME_PATTERN, { message: "Los nombres solo admiten letras" })
  @MinLength(2)
  @MaxLength(100)
  nombres: string;

  @IsString()
  @NormalizeText()
  @Matches(PERSON_NAME_PATTERN, {
    message: "Los apellidos solo admiten letras",
  })
  @MinLength(2)
  @MaxLength(120)
  apellidos: string;

  @IsOptional()
  @IsString()
  @NormalizeText()
  @Matches(DOCUMENT_PATTERN, { message: "Documento no válido" })
  @MaxLength(30)
  numeroDocumento?: string;

  @IsString()
  @NormalizeText()
  @MinLength(2)
  @MaxLength(120)
  especialidad: string;

  @IsOptional()
  @NormalizeLowerText()
  @IsEmail()
  @MaxLength(180)
  correo?: string;

  @IsOptional()
  @IsString()
  @NormalizeText()
  @Matches(PHONE_PATTERN, { message: "Teléfono no válido" })
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsString()
  @Matches(PHOTO_SOURCE_PATTERN, { message: "Formato de fotografía no válido" })
  @MaxLength(800000)
  fotografiaUrl?: string;
}
