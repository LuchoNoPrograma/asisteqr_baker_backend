import { Jornada } from "@prisma/client";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";

export class ScanQrDto {
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  tokenQr: string;

  @IsEnum(Jornada)
  jornada: Jornada;
}
