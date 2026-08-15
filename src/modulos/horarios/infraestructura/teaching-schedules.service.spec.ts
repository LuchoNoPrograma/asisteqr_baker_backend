import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { TeachingSchedulesService } from "./teaching-schedules.service";

const actor: AuthenticatedUser = {
  sub: "10000000-0000-4000-8000-000000000001",
  usuario: "admin",
  nombreCompleto: "Administrador Baker",
  roles: ["ADMINISTRADOR"],
  sesionId: "session-1",
};

describe("TeachingSchedulesService", () => {
  it("persiste cada bloque enlazado a su asignación académica", async () => {
    const periodId = "20000000-0000-4000-8000-000000000001";
    const courseId = "30000000-0000-4000-8000-000000000001";
    const subjectId = "40000000-0000-4000-8000-000000000001";
    const teacherId = "50000000-0000-4000-8000-000000000001";
    const classroomId = "60000000-0000-4000-8000-000000000001";
    const assignmentId = "70000000-0000-4000-8000-000000000001";
    const createManyBlocks = jest.fn().mockResolvedValue({ count: 1 });
    const assignmentFindMany = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: assignmentId,
          cursoId: courseId,
          materiaId: subjectId,
          docenteId: teacherId,
        },
      ]);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: 1 }]),
      configuracionHorario: {
        findUnique: jest.fn().mockResolvedValue({
          id: "80000000-0000-4000-8000-000000000001",
          periodoId: periodId,
          horaInicio: new Date("1970-01-01T08:00:00.000Z"),
          horaFin: new Date("1970-01-01T13:00:00.000Z"),
          intervaloMinutos: 30,
          toleranciaMinutos: 5,
          zonaHoraria: "America/La_Paz",
          version: 1,
          recreos: [],
        }),
        update: jest.fn().mockResolvedValue({ version: 2 }),
      },
      periodoAcademico: {
        findUnique: jest.fn().mockResolvedValue({ gestion: 2026 }),
      },
      asignacionAcademica: {
        findMany: assignmentFindMany,
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({ id: assignmentId }),
      },
      horarioClase: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: createManyBlocks,
      },
      curso: { findMany: jest.fn().mockResolvedValue([{ id: courseId }]) },
      materia: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: subjectId, nombre: "Matemática" }]),
      },
      docente: { findMany: jest.fn().mockResolvedValue([{ id: teacherId }]) },
      aula: { findMany: jest.fn().mockResolvedValue([{ id: classroomId }]) },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as unknown as PrismaService;

    const result = await new TeachingSchedulesService(prisma).savePlanner(
      {
        periodoId: periodId,
        version: 1,
        asignaciones: [
          {
            cursoId: courseId,
            materiaId: subjectId,
            docenteId: teacherId,
            minutosSemanales: 120,
          },
        ],
        bloques: [
          {
            cursoId: courseId,
            materiaId: subjectId,
            docenteId: teacherId,
            aulaId: classroomId,
            diaSemana: 1,
            horaInicio: "08:00",
            horaFin: "09:00",
          },
        ],
        asignacionesEliminadas: [],
        bloquesEliminados: [],
      },
      actor,
    );

    expect(result).toEqual({ version: 2 });
    expect(tx.asignacionAcademica.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ minutosSemanales: 60 }),
        create: expect.objectContaining({ minutosSemanales: 60 }),
      }),
    );
    expect(createManyBlocks).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          asignacionId: assignmentId,
          cursoId: courseId,
          materiaId: subjectId,
          docenteId: teacherId,
          aulaId: classroomId,
        }),
      ],
    });
  });
});
