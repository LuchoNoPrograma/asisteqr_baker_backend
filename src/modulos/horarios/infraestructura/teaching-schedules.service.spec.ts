import "reflect-metadata";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import {
  SaveSchedulePlannerDto,
  SchedulePlannerAssignmentDto,
  SchedulePlannerBlockDto,
} from "../aplicacion/dto/save-schedule-planner.dto";
import { validate } from "class-validator";
import { TeachingSchedulesService } from "./teaching-schedules.service";

const actor: AuthenticatedUser = {
  sub: 1,
  usuario: "admin",
  nombreCompleto: "Administrador Baker",
  roles: ["ADMINISTRADOR"],
  sesionId: 1,
};

describe("TeachingSchedulesService", () => {
  it("persiste cada bloque enlazado a su asignación académica", async () => {
    const periodId = 1;
    const courseId = 1;
    const subjectId = 1;
    const teacherId = 1;
    const classroomId = 1;
    const assignmentId = 1;
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
          id: 1,
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
        update: expect.objectContaining({ minutosSemanales: 120 }),
        create: expect.objectContaining({ minutosSemanales: 120 }),
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

  it("permite cargar un periodo antes de crear su configuración", async () => {
    const periodId = 1;
    const prisma = {
      periodoAcademico: {
        findFirst: jest.fn().mockResolvedValue({
          id: periodId,
          nombre: "Gestión",
          gestion: 2026,
        }),
      },
      configuracionHorario: { findUnique: jest.fn().mockResolvedValue(null) },
      curso: { findMany: jest.fn().mockResolvedValue([]) },
      materia: { findMany: jest.fn().mockResolvedValue([]) },
      aula: { findMany: jest.fn().mockResolvedValue([]) },
      docente: { findMany: jest.fn().mockResolvedValue([]) },
      asignacionAcademica: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const result = await new TeachingSchedulesService(prisma).loadPlanner();

    expect(result).toEqual(
      expect.objectContaining({
        configuracion: null,
        recreos: [],
        bloques: [],
      }),
    );
  });

  it("rechaza una jornada que desalinea bloques existentes", async () => {
    const tx = generalConfigTransaction();
    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as unknown as PrismaService;

    await expect(
      new TeachingSchedulesService(prisma).saveGeneralConfig(
        generalConfigDto("07:45", "13:45"),
        actor,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "CONFIGURACION_AFECTA_CLASES",
      }),
    });
    expect(tx.configuracionHorario.update).not.toHaveBeenCalled();
  });

  it("acepta una jornada nueva cuando los bloques conservan la alineación", async () => {
    const tx = generalConfigTransaction();
    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as unknown as PrismaService;

    const result = await new TeachingSchedulesService(prisma).saveGeneralConfig(
      generalConfigDto("07:30", "13:30"),
      actor,
    );

    expect(result.version).toBe(2);
    expect(tx.configuracionHorario.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      escenario: "repite una asignación activa",
      dto: plannerDiffDto({ duplicateAssignment: true }),
    },
    {
      escenario: "activa y elimina la misma asignación",
      dto: plannerDiffDto({ removeAssignment: true }),
    },
    {
      escenario: "repite una asignación eliminada",
      dto: plannerDiffDto({ duplicateRemovedAssignment: true }),
    },
    {
      escenario: "repite un bloque activo",
      dto: plannerDiffDto({ duplicateBlock: true }),
    },
    {
      escenario: "activa y elimina el mismo bloque",
      dto: plannerDiffDto({ removeBlock: true }),
    },
    {
      escenario: "repite un bloque eliminado",
      dto: plannerDiffDto({ duplicateRemovedBlock: true }),
    },
  ])(
    "rechaza el diff antes de la transacción cuando $escenario",
    async ({ dto }) => {
      const transaction = jest.fn();
      const service = new TeachingSchedulesService({
        $transaction: transaction,
      } as unknown as PrismaService);

      await expect(service.savePlanner(dto, actor)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "PAYLOAD_PLANIFICADOR_CONTRADICTORIO",
        }),
      });
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});

describe("SchedulePlannerAssignmentDto", () => {
  const assignment = (minutosSemanales: number) =>
    Object.assign(new SchedulePlannerAssignmentDto(), {
      cursoId: 1,
      materiaId: 1,
      docenteId: 1,
      minutosSemanales,
    });

  it.each([30, 2400])("acepta %i minutos semanales", async (minutes) => {
    expect(await validate(assignment(minutes))).toHaveLength(0);
  });

  it.each([29, 31, 2430])("rechaza %i minutos semanales", async (minutes) => {
    expect(await validate(assignment(minutes))).not.toHaveLength(0);
  });
});

describe("SchedulePlannerBlockDto", () => {
  const block = (diaSemana: number) =>
    Object.assign(new SchedulePlannerBlockDto(), {
      cursoId: 1,
      materiaId: 1,
      docenteId: 1,
      aulaId: 1,
      diaSemana,
      horaInicio: "08:00",
      horaFin: "09:00",
    });

  it.each([1, 5])("acepta el día hábil %i", async (day) => {
    expect(await validate(block(day))).toHaveLength(0);
  });

  it.each([0, 6, 7])("rechaza el día no hábil %i", async (day) => {
    expect(await validate(block(day))).not.toHaveLength(0);
  });
});

function generalConfigDto(horaInicio: string, horaFin: string) {
  return {
    periodoId: 1,
    version: 1,
    horaInicio,
    horaFin,
    intervaloMinutos: 30,
    toleranciaMinutos: 5,
    zonaHoraria: "America/La_Paz",
    recreos: [],
  };
}

function generalConfigTransaction() {
  const savedConfig = {
    id: 1,
    periodoId: 1,
    horaInicio: new Date("1970-01-01T07:30:00.000Z"),
    horaFin: new Date("1970-01-01T13:30:00.000Z"),
    intervaloMinutos: 30,
    toleranciaMinutos: 5,
    zonaHoraria: "America/La_Paz",
    version: 2,
    recreos: [],
  };
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ locked: 1 }]),
    periodoAcademico: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
      }),
    },
    configuracionHorario: {
      findUnique: jest.fn().mockResolvedValue({
        ...savedConfig,
        horaInicio: new Date("1970-01-01T08:00:00.000Z"),
        horaFin: new Date("1970-01-01T13:00:00.000Z"),
        version: 1,
      }),
      update: jest.fn().mockResolvedValue(savedConfig),
      findUniqueOrThrow: jest.fn().mockResolvedValue(savedConfig),
    },
    horarioClase: {
      findMany: jest.fn().mockResolvedValue([
        {
          horaInicio: new Date("1970-01-01T08:00:00.000Z"),
          horaFin: new Date("1970-01-01T09:00:00.000Z"),
        },
      ]),
    },
    recreoHorario: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    auditoria: { create: jest.fn().mockResolvedValue({}) },
  };
}

function plannerDiffDto({
  duplicateAssignment = false,
  removeAssignment = false,
  duplicateRemovedAssignment = false,
  duplicateBlock = false,
  removeBlock = false,
  duplicateRemovedBlock = false,
}: {
  duplicateAssignment?: boolean;
  removeAssignment?: boolean;
  duplicateRemovedAssignment?: boolean;
  duplicateBlock?: boolean;
  removeBlock?: boolean;
  duplicateRemovedBlock?: boolean;
}): SaveSchedulePlannerDto {
  const assignmentId = 1;
  const blockId = 1;
  const assignment = {
    id: assignmentId,
    cursoId: 1,
    materiaId: 1,
    docenteId: 1,
    minutosSemanales: 120,
  };
  const block = {
    id: blockId,
    cursoId: assignment.cursoId,
    materiaId: assignment.materiaId,
    docenteId: assignment.docenteId,
    aulaId: 1,
    diaSemana: 1,
    horaInicio: "08:00",
    horaFin: "09:00",
  };
  return {
    periodoId: 1,
    version: 1,
    asignaciones: duplicateAssignment ? [assignment, assignment] : [assignment],
    bloques: duplicateBlock ? [block, block] : [block],
    asignacionesEliminadas: duplicateRemovedAssignment
      ? [assignmentId, assignmentId]
      : removeAssignment
        ? [assignmentId]
        : [],
    bloquesEliminados: duplicateRemovedBlock
      ? [blockId, blockId]
      : removeBlock
        ? [blockId]
        : [],
  };
}
