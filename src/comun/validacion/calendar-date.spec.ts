import { BadRequestException } from "@nestjs/common";
import { parseCalendarDate } from "./calendar-date";

describe("parseCalendarDate", () => {
  it.each([
    "2026-02-29",
    "2026-02-30",
    "2026-02-31",
    "2026-04-31",
    "2026-13-01",
    "2026-2-01",
  ])("rechaza la fecha calendario inexistente o no canónica %s", (value) => {
    expect(() => parseCalendarDate(value, "fecha")).toThrow(
      BadRequestException,
    );
  });

  it("acepta el 29 de febrero de un año bisiesto sin rollover", () => {
    expect(parseCalendarDate("2028-02-29", "fecha").toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });
});
