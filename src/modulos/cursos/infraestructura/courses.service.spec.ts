import { PrismaService } from "../../../comun/prisma/prisma.service";
import { CoursesService } from "./courses.service";

describe("CoursesService", () => {
  it("deriva los docentes únicos de las asignaciones académicas activas", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "10000000-0000-4000-8000-000000000001",
        nombre: "4.º Secundaria B",
        nivel: "4.º Secundaria",
        paralelo: "B",
        gestion: 2026,
        activo: true,
        _count: { inscripciones: 31 },
        asignacionesAcademicas: [
          { docenteId: "20000000-0000-4000-8000-000000000001" },
          { docenteId: "20000000-0000-4000-8000-000000000001" },
          { docenteId: "20000000-0000-4000-8000-000000000002" },
        ],
        horarios: [],
      },
    ]);
    const prisma = { curso: { findMany } } as unknown as PrismaService;

    const result = await new CoursesService(prisma).list();

    expect(result[0]).toMatchObject({
      cantidadEstudiantes: 31,
      cantidadDocentes: 2,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          asignacionesAcademicas: expect.objectContaining({
            select: { docenteId: true },
          }),
        }),
      }),
    );
  });
});
