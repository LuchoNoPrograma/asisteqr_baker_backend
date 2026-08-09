import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  usuario: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  contrasena: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  dispositivo?: string;
}
