import { EstadoAsistencia } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  it("CP-11 genera un PDF mensual con los registros autorizados", async () => {
    const prisma = {
      asistencia: {
        groupBy: jest.fn().mockResolvedValue([
          {
            estado: EstadoAsistencia.PUNTUAL,
            _count: { _all: 1 },
          },
        ]),
        findMany: jest.fn().mockResolvedValue([
          {
            fechaLocal: new Date("2026-08-08T00:00:00.000Z"),
            fechaHora: new Date("2026-08-08T11:55:00.000Z"),
            estado: EstadoAsistencia.PUNTUAL,
            estudiante: { nombres: "Valeria", apellidos: "Mendoza Rojas" },
            curso: { nombre: "4.º Secundaria B" },
          },
        ]),
      },
      inscripcion: { count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;

    const pdf = await new ReportsService(prisma).exportPdf(
      "2026-08-01",
      "2026-08-31",
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
