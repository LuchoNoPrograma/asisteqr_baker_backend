import { IsString, MaxLength, MinLength } from "class-validator";

export class ScanQrDto {
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  tokenQr: string;
}
