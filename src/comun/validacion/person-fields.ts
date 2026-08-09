import { Transform } from "class-transformer";

export const PERSON_NAME_PATTERN =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;

export const DOCUMENT_PATTERN =
  /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]+(?:[ .-][A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]+)*$/;

export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,18}$/;

export const PHOTO_SOURCE_PATTERN =
  /^(?:data:image\/(?:jpeg|png|webp);base64,|https?:\/\/|\/)/i;

export function NormalizeText(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") return value;
    return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-BO");
  });
}

export function NormalizePlainText(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") return value;
    return value.trim().replace(/\s+/g, " ");
  });
}

export function NormalizeLowerText(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") return value;
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-BO");
  });
}
