import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class SaveSubjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  codigo: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;
}

export class SaveClassroomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  codigo: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  capacidad?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  ubicacion?: string;
}
