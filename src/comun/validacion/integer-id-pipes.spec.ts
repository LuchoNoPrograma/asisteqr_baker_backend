import { BadRequestException } from "@nestjs/common";
import { ArgumentMetadata } from "@nestjs/common/interfaces";
import {
  optionalPositiveIntegerIdPipe,
  positiveIntegerIdPipe,
} from "./integer-id-pipes";

const metadata: ArgumentMetadata = { type: "param", data: "id" };

describe("integer ID pipes", () => {
  it.each(["uuid", "0", "-1", "1.5", "9007199254740992"])(
    "rechaza el ID inválido %s con 400",
    (value) => {
      expect(() => positiveIntegerIdPipe.transform(value, metadata)).toThrow(
        BadRequestException,
      );
    },
  );

  it("convierte IDs positivos y permite ausencia en filtros opcionales", () => {
    expect(positiveIntegerIdPipe.transform("42", metadata)).toBe(42);
    expect(
      optionalPositiveIntegerIdPipe.transform(undefined, metadata),
    ).toBeUndefined();
  });
});
