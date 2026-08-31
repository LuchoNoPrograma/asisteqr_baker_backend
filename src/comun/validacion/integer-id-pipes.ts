import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";

@Injectable()
class PositiveIntegerIdPipe
  implements PipeTransform<string | undefined, number | undefined>
{
  constructor(private readonly optional = false) {}

  transform(value: string | undefined, metadata: ArgumentMetadata) {
    void metadata;
    if (value === undefined && this.optional) return undefined;
    if (!value || !/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException("El ID debe ser un entero positivo");
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw new BadRequestException("El ID está fuera del rango permitido");
    }
    return parsed;
  }
}

export const positiveIntegerIdPipe = new PositiveIntegerIdPipe();
export const optionalPositiveIntegerIdPipe = new PositiveIntegerIdPipe(true);
