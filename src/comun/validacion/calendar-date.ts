import { BadRequestException } from "@nestjs/common";
import { DateTime } from "luxon";

export function parseCalendarDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException(`${field} debe usar el formato YYYY-MM-DD`);
  const parsed = DateTime.fromFormat(value, "yyyy-MM-dd", {
    zone: "utc",
    locale: "en",
  });
  if (!parsed.isValid || parsed.toFormat("yyyy-MM-dd") !== value)
    throw new BadRequestException(`${field} no es una fecha válida`);
  return parsed.startOf("day").toJSDate();
}
