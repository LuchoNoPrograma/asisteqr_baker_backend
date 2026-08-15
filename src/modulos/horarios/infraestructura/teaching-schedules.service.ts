import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EstadoDocente, EstadoPeriodo, Prisma } from "@prisma/client";
import { IANAZone } from "luxon";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { SaveGeneralScheduleConfigDto } from "../aplicacion/dto/save-general-schedule-config.dto";
import {
  SaveSchedulePlannerDto,
  SchedulePlannerBlockDto,
} from "../aplicacion/dto/save-schedule-planner.dto";
import {
  SaveTeacherScheduleMatrixDto,
  TeacherScheduleBlockDto,
} from "../aplicacion/dto/save-teacher-schedule-matrix.dto";
import { SaveTeachingScheduleDto } from "../aplicacion/dto/save-teaching-schedule.dto";

const scheduleRelations = {
  docente: true,
  curso: true,
  materiaCatalogo: true,
  aula: true,
  asignacion: {
    include: {
      curso: true,
      materia: true,
      docente: true,
    },
  },
} satisfies Prisma.HorarioClaseInclude;

type TeachingScheduleWithRelations = Prisma.HorarioClaseGetPayload<{
  include: typeof scheduleRelations;
}>;

@Injectable()
export class TeachingSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(docenteId?: string, cursoId?: string) {
    const schedules = await this.prisma.horarioClase.findMany({
      where: {
        activo: true,
        docente: { estado: EstadoDocente.ACTIVO },
        curso: { activo: true },
        ...(docenteId ? { docenteId } : {}),
        ...(cursoId ? { cursoId } : {}),
      },
      include: scheduleRelations,
      orderBy: [
        { diaSemana: "asc" },
        { horaInicio: "asc" },
        { curso: { nombre: "asc" } },
      ],
      take: 500,
    });
    return schedules.map((schedule) => this.toResponse(schedule));
  }

  async loadEditor(docenteId: string, periodoId?: string) {
    const period = periodoId
      ? await this.prisma.periodoAcademico.findUnique({
          where: { id: periodoId },
        })
      : await this.prisma.periodoAcademico.findFirst({
          where: { estado: EstadoPeriodo.ACTIVO },
          orderBy: { fechaInicio: "desc" },
        });
    if (!period) throw new NotFoundException("Periodo académico no encontrado");

    const [teacher, config, courses, subjects, classrooms] = await Promise.all([
      this.prisma.docente.findFirst({
        where: { id: docenteId, estado: EstadoDocente.ACTIVO },
      }),
      this.prisma.configuracionHorario.findUnique({
        where: { periodoId: period.id },
        include: {
          recreos: {
            where: { activo: true },
            orderBy: { horaInicio: "asc" },
          },
          horariosClase: {
            where: { docenteId, activo: true },
            include: scheduleRelations,
            orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
          },
        },
      }),
      this.prisma.curso.findMany({
        where: { activo: true, gestion: period.gestion },
        orderBy: { nombre: "asc" },
      }),
      this.prisma.materia.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
      }),
      this.prisma.aula.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
      }),
    ]);
    if (!teacher) throw new NotFoundException("Docente activo no encontrado");
    if (!config)
      throw new BadRequestException(
        "Primero configure el horario general del periodo académico",
      );

    return {
      docente: {
        id: teacher.id,
        codigo: teacher.codigoDocente,
        nombreCompleto: `${teacher.nombres} ${teacher.apellidos}`,
        especialidad: teacher.especialidad,
        telefono: teacher.telefono,
        correo: teacher.correo,
        fotografiaUrl: teacher.fotografiaUrl,
      },
      periodo: {
        id: period.id,
        nombre: period.nombre,
        gestion: period.gestion,
      },
      configuracion: this.configResponse(config),
      recreos: config.recreos.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        horaInicio: this.formatTime(item.horaInicio),
        horaFin: this.formatTime(item.horaFin),
      })),
      cursos: courses.map((item) => ({ id: item.id, nombre: item.nombre })),
      materias: subjects.map((item) => ({
        id: item.id,
        nombre: item.nombre,
      })),
      aulas: classrooms.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        capacidad: item.capacidad,
        ubicacion: item.ubicacion,
      })),
      bloques: config.horariosClase.map((item) => this.blockResponse(item)),
    };
  }

  async loadPlanner(periodoId?: string) {
    const period = periodoId
      ? await this.prisma.periodoAcademico.findUnique({
          where: { id: periodoId },
        })
      : await this.prisma.periodoAcademico.findFirst({
          where: { estado: EstadoPeriodo.ACTIVO },
          orderBy: { fechaInicio: "desc" },
        });
    if (!period) throw new NotFoundException("Periodo académico no encontrado");

    const [config, courses, subjects, classrooms, teachers, assignments] =
      await Promise.all([
        this.prisma.configuracionHorario.findUnique({
          where: { periodoId: period.id },
          include: {
            recreos: {
              where: { activo: true },
              orderBy: { horaInicio: "asc" },
            },
            horariosClase: {
              where: { activo: true },
              include: scheduleRelations,
              orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
            },
          },
        }),
        this.prisma.curso.findMany({
          where: { activo: true, gestion: period.gestion },
          orderBy: [{ nivel: "asc" }, { paralelo: "asc" }],
        }),
        this.prisma.materia.findMany({
          where: { activo: true },
          orderBy: { nombre: "asc" },
        }),
        this.prisma.aula.findMany({
          where: { activo: true },
          orderBy: { nombre: "asc" },
        }),
        this.prisma.docente.findMany({
          where: { estado: EstadoDocente.ACTIVO },
          orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
        }),
        this.prisma.asignacionAcademica.findMany({
          where: { periodoId: period.id, activo: true },
          orderBy: [
            { curso: { nombre: "asc" } },
            { materia: { nombre: "asc" } },
          ],
        }),
      ]);
    if (!config)
      throw new BadRequestException(
        "Primero configure el horario general del periodo académico",
      );

    const scheduledByAssignment = new Map<string, number>();
    for (const block of config.horariosClase) {
      if (!block.asignacionId) continue;
      scheduledByAssignment.set(
        block.asignacionId,
        (scheduledByAssignment.get(block.asignacionId) ?? 0) +
          this.minutes(this.formatTime(block.horaFin)) -
          this.minutes(this.formatTime(block.horaInicio)),
      );
    }
    const assignmentResponses = assignments.map((item) => ({
      id: item.id,
      cursoId: item.cursoId,
      materiaId: item.materiaId,
      docenteId: item.docenteId,
      minutosSemanales:
        scheduledByAssignment.get(item.id) ?? config.intervaloMinutos,
      minutosProgramados: scheduledByAssignment.get(item.id) ?? 0,
    }));

    return {
      periodo: {
        id: period.id,
        nombre: period.nombre,
        gestion: period.gestion,
      },
      configuracion: this.configResponse(config),
      recreos: config.recreos.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        horaInicio: this.formatTime(item.horaInicio),
        horaFin: this.formatTime(item.horaFin),
      })),
      cursos: courses.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        nivel: item.nivel,
        paralelo: item.paralelo,
      })),
      materias: subjects.map((item) => ({
        id: item.id,
        nombre: item.nombre,
      })),
      aulas: classrooms.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        capacidad: item.capacidad,
        ubicacion: item.ubicacion,
      })),
      docentes: teachers.map((item) => ({
        id: item.id,
        codigo: item.codigoDocente,
        nombreCompleto: `${item.nombres} ${item.apellidos}`,
        especialidad: item.especialidad,
        fotografiaUrl: item.fotografiaUrl,
      })),
      asignaciones: assignmentResponses,
      bloques: config.horariosClase
        .filter((item) => item.asignacion && item.aulaId)
        .map((item) => this.plannerBlockResponse(item)),
    };
  }

  async savePlanner(dto: SaveSchedulePlannerDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockPeriod(tx, dto.periodoId);
      const config = await tx.configuracionHorario.findUnique({
        where: { periodoId: dto.periodoId },
        include: { recreos: { where: { activo: true } } },
      });
      if (!config)
        throw new BadRequestException(
          "No existe configuración general para el periodo académico",
        );
      if (config.version !== dto.version)
        this.throwStaleVersion(config.version);

      const period = await tx.periodoAcademico.findUnique({
        where: { id: dto.periodoId },
        select: { gestion: true },
      });
      if (!period)
        throw new NotFoundException("Periodo académico no encontrado");

      const [currentAssignments, currentBlocks] = await Promise.all([
        tx.asignacionAcademica.findMany({
          where: { periodoId: dto.periodoId, activo: true },
        }),
        tx.horarioClase.findMany({
          where: { configuracionId: config.id, activo: true },
          include: { asignacion: true },
        }),
      ]);
      const currentAssignmentIds = new Set(
        currentAssignments.map((item) => item.id),
      );
      const currentBlockIds = new Set(currentBlocks.map((item) => item.id));
      const referencedAssignmentIds = [
        ...dto.asignaciones.flatMap((item) => (item.id ? [item.id] : [])),
        ...dto.asignacionesEliminadas,
      ];
      const referencedBlockIds = [
        ...dto.bloques.flatMap((item) => (item.id ? [item.id] : [])),
        ...dto.bloquesEliminados,
      ];
      if (referencedAssignmentIds.some((id) => !currentAssignmentIds.has(id)))
        throw new BadRequestException(
          "Una asignación indicada no pertenece al periodo activo",
        );
      if (referencedBlockIds.some((id) => !currentBlockIds.has(id)))
        throw new BadRequestException(
          "Un bloque indicado no pertenece al horario activo",
        );

      const assignmentUpdates = new Map(
        dto.asignaciones
          .filter((item) => item.id)
          .map((item) => [item.id!, item]),
      );
      const removedAssignmentIds = new Set(dto.asignacionesEliminadas);
      const effectiveAssignments = [
        ...currentAssignments
          .filter((item) => !removedAssignmentIds.has(item.id))
          .map((item) => assignmentUpdates.get(item.id) ?? item),
        ...dto.asignaciones.filter((item) => !item.id),
      ];
      const blockUpdates = new Map(
        dto.bloques.filter((item) => item.id).map((item) => [item.id!, item]),
      );
      const removedBlockIds = new Set(dto.bloquesEliminados);
      const effectiveBlocks = [
        ...currentBlocks
          .filter((item) => !removedBlockIds.has(item.id))
          .map((item) => {
            const update = blockUpdates.get(item.id);
            if (update) return update;
            if (!item.asignacion || !item.aulaId)
              throw new BadRequestException(
                "Existe un bloque activo sin asignación académica o aula",
              );
            return {
              id: item.id,
              cursoId: item.asignacion.cursoId,
              materiaId: item.asignacion.materiaId,
              docenteId: item.asignacion.docenteId,
              aulaId: item.aulaId,
              diaSemana: item.diaSemana,
              horaInicio: this.formatTime(item.horaInicio),
              horaFin: this.formatTime(item.horaFin),
            };
          }),
        ...dto.bloques.filter((item) => !item.id),
      ];

      const courseIds = [
        ...new Set(effectiveAssignments.map((item) => item.cursoId)),
      ];
      const subjectIds = [
        ...new Set(effectiveAssignments.map((item) => item.materiaId)),
      ];
      const teacherIds = [
        ...new Set(effectiveAssignments.map((item) => item.docenteId)),
      ];
      const classroomIds = [
        ...new Set(effectiveBlocks.map((item) => item.aulaId)),
      ];
      const [courses, subjects, teachers, classrooms] = await Promise.all([
        tx.curso.findMany({
          where: {
            id: { in: courseIds },
            activo: true,
            gestion: period.gestion,
          },
          select: { id: true },
        }),
        tx.materia.findMany({
          where: { id: { in: subjectIds }, activo: true },
          select: { id: true, nombre: true },
        }),
        tx.docente.findMany({
          where: { id: { in: teacherIds }, estado: EstadoDocente.ACTIVO },
          select: { id: true },
        }),
        tx.aula.findMany({
          where: { id: { in: classroomIds }, activo: true },
          select: { id: true },
        }),
      ]);
      if (courses.length !== courseIds.length)
        throw new BadRequestException(
          "Uno de los cursos no está activo en la gestión",
        );
      if (subjects.length !== subjectIds.length)
        throw new BadRequestException("Una de las materias no está activa");
      if (teachers.length !== teacherIds.length)
        throw new BadRequestException("Uno de los docentes no está activo");
      if (classrooms.length !== classroomIds.length)
        throw new BadRequestException("Una de las aulas no está activa");

      const assignmentByCourseSubject = new Map<
        string,
        (typeof effectiveAssignments)[number]
      >();
      for (const assignment of effectiveAssignments) {
        const key = `${assignment.cursoId}|${assignment.materiaId}`;
        if (assignmentByCourseSubject.has(key))
          throw new ConflictException({
            code: "ASIGNACION_DUPLICADA",
            message: "Una materia solo puede tener una asignación por curso",
          });
        assignmentByCourseSubject.set(key, assignment);
      }
      for (const block of effectiveBlocks) {
        const assignment = assignmentByCourseSubject.get(
          `${block.cursoId}|${block.materiaId}`,
        );
        if (!assignment || assignment.docenteId !== block.docenteId)
          throw new BadRequestException(
            "Cada bloque debe corresponder a una asignación académica activa",
          );
      }

      const normalized = effectiveBlocks.map((block) => ({
        block,
        start: this.minutes(block.horaInicio),
        end: this.minutes(block.horaFin),
      }));
      this.validatePlannerBlocks(normalized, config);
      const scheduledByAssignment = new Map<string, number>();
      for (const item of normalized) {
        const key = `${item.block.cursoId}|${item.block.materiaId}`;
        scheduledByAssignment.set(
          key,
          (scheduledByAssignment.get(key) ?? 0) + item.end - item.start,
        );
      }
      const automaticWeeklyMinutes = (assignment: {
        cursoId: string;
        materiaId: string;
      }) =>
        scheduledByAssignment.get(
          `${assignment.cursoId}|${assignment.materiaId}`,
        ) ?? config.intervaloMinutos;

      const subjectById = new Map(
        subjects.map((item) => [item.id, item.nombre]),
      );
      await Promise.all([
        ...dto.asignaciones
          .filter((item) => item.id)
          .map((item) =>
            tx.asignacionAcademica.update({
              where: { id: item.id },
              data: {
                cursoId: item.cursoId,
                materiaId: item.materiaId,
                docenteId: item.docenteId,
                minutosSemanales: automaticWeeklyMinutes(item),
                activo: true,
              },
            }),
          ),
        tx.asignacionAcademica.updateMany({
          where: {
            periodoId: dto.periodoId,
            id: { in: dto.asignacionesEliminadas },
          },
          data: { activo: false },
        }),
        tx.horarioClase.updateMany({
          where: {
            configuracionId: config.id,
            id: { in: dto.bloquesEliminados },
          },
          data: { activo: false },
        }),
      ]);
      const newAssignments = dto.asignaciones.filter((item) => !item.id);
      if (newAssignments.length) {
        await Promise.all(
          newAssignments.map((item) =>
            tx.asignacionAcademica.upsert({
              where: {
                periodoId_cursoId_materiaId: {
                  periodoId: dto.periodoId,
                  cursoId: item.cursoId,
                  materiaId: item.materiaId,
                },
              },
              update: {
                docenteId: item.docenteId,
                minutosSemanales: automaticWeeklyMinutes(item),
                activo: true,
              },
              create: {
                periodoId: dto.periodoId,
                cursoId: item.cursoId,
                materiaId: item.materiaId,
                docenteId: item.docenteId,
                minutosSemanales: automaticWeeklyMinutes(item),
              },
            }),
          ),
        );
      }

      const persistedAssignments = await tx.asignacionAcademica.findMany({
        where: { periodoId: dto.periodoId, activo: true },
        select: {
          id: true,
          cursoId: true,
          materiaId: true,
          docenteId: true,
        },
      });
      const persistedAssignmentByKey = new Map(
        persistedAssignments.map((item) => [
          this.assignmentKey(item.cursoId, item.materiaId, item.docenteId),
          item,
        ]),
      );
      const assignmentForBlock = (block: SchedulePlannerBlockDto) => {
        const assignment = persistedAssignmentByKey.get(
          this.assignmentKey(block.cursoId, block.materiaId, block.docenteId),
        );
        if (!assignment)
          throw new BadRequestException(
            "Cada bloque debe enlazar una asignación académica persistida",
          );
        return assignment;
      };

      await Promise.all(
        dto.bloques
          .filter((item) => item.id)
          .map((item) => {
            const assignment = assignmentForBlock(item);
            return tx.horarioClase.update({
              where: { id: item.id },
              data: {
                asignacionId: assignment.id,
                docenteId: assignment.docenteId,
                cursoId: assignment.cursoId,
                materiaId: assignment.materiaId,
                aulaId: item.aulaId,
                materia: subjectById.get(assignment.materiaId)!,
                diaSemana: item.diaSemana,
                horaInicio: this.parseTime(item.horaInicio),
                horaFin: this.parseTime(item.horaFin),
                activo: true,
              },
            });
          }),
      );
      const newBlocks = dto.bloques.filter((item) => !item.id);
      if (newBlocks.length) {
        await tx.horarioClase.createMany({
          data: newBlocks.map((item) => {
            const assignment = assignmentForBlock(item);
            return {
              configuracionId: config.id,
              asignacionId: assignment.id,
              docenteId: assignment.docenteId,
              cursoId: assignment.cursoId,
              materiaId: assignment.materiaId,
              aulaId: item.aulaId,
              materia: subjectById.get(assignment.materiaId)!,
              diaSemana: item.diaSemana,
              horaInicio: this.parseTime(item.horaInicio),
              horaFin: this.parseTime(item.horaFin),
              creadoPor: actor.sub,
            };
          }),
        });
      }
      const updatedConfig = await tx.configuracionHorario.update({
        where: { id: config.id },
        data: { version: { increment: 1 } },
      });
      await tx.auditoria.create({
        data: {
          usuarioId: actor.sub,
          accion: "PLANIFICADOR_HORARIOS_GUARDADO",
          recurso: "horarios_clase",
          recursoId: config.id,
          metadatos: {
            periodoId: dto.periodoId,
            asignacionesModificadas: dto.asignaciones.length,
            bloquesModificados: dto.bloques.length,
            version: updatedConfig.version,
          },
        },
      });
      return { version: updatedConfig.version };
    });
  }

  async saveMatrix(
    docenteId: string,
    dto: SaveTeacherScheduleMatrixDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockPeriod(tx, dto.periodoId);
      const [teacher, config, period, courses, subjects, classrooms] =
        await Promise.all([
          tx.docente.findFirst({
            where: { id: docenteId, estado: EstadoDocente.ACTIVO },
            select: { id: true },
          }),
          tx.configuracionHorario.findUnique({
            where: { periodoId: dto.periodoId },
            include: { recreos: { where: { activo: true } } },
          }),
          tx.periodoAcademico.findUnique({
            where: { id: dto.periodoId },
            select: { gestion: true },
          }),
          tx.curso.findMany({
            where: {
              id: { in: dto.bloques.map((item) => item.cursoId) },
              activo: true,
            },
            select: { id: true, gestion: true },
          }),
          tx.materia.findMany({
            where: {
              id: { in: dto.bloques.map((item) => item.materiaId) },
              activo: true,
            },
            select: { id: true, nombre: true },
          }),
          tx.aula.findMany({
            where: {
              id: { in: dto.bloques.map((item) => item.aulaId) },
              activo: true,
            },
            select: { id: true },
          }),
        ]);
      if (!teacher) throw new NotFoundException("Docente activo no encontrado");
      if (!config)
        throw new BadRequestException(
          "No existe configuración general para el periodo académico",
        );
      if (!period)
        throw new NotFoundException("Periodo académico no encontrado");
      if (config.version !== dto.version)
        this.throwStaleVersion(config.version);

      const courseIds = new Set(courses.map((item) => item.id));
      const subjectById = new Map(subjects.map((item) => [item.id, item]));
      const classroomIds = new Set(classrooms.map((item) => item.id));
      for (const block of dto.bloques) {
        if (
          !courseIds.has(block.cursoId) ||
          courses.find((item) => item.id === block.cursoId)?.gestion !==
            period.gestion
        )
          throw new BadRequestException("Uno de los cursos no está activo");
        if (!subjectById.has(block.materiaId))
          throw new BadRequestException("Una de las materias no está activa");
        if (!classroomIds.has(block.aulaId))
          throw new BadRequestException("Una de las aulas no está activa");
      }

      const normalized = dto.bloques.map((block) => ({
        block,
        start: this.minutes(block.horaInicio),
        end: this.minutes(block.horaFin),
      }));
      this.validateBlocks(normalized, config);

      const days = [...new Set(dto.bloques.map((item) => item.diaSemana))];
      const external = await tx.horarioClase.findMany({
        where: {
          configuracionId: config.id,
          activo: true,
          docenteId: { not: docenteId },
          diaSemana: { in: days },
          OR: [
            { cursoId: { in: [...courseIds] } },
            { aulaId: { in: [...classroomIds] } },
          ],
        },
        include: { docente: true, curso: true, aula: true },
      });
      for (const candidate of normalized) {
        const conflict = external.find(
          (item) =>
            item.diaSemana === candidate.block.diaSemana &&
            this.overlaps(
              candidate.start,
              candidate.end,
              this.minutes(this.formatTime(item.horaInicio)),
              this.minutes(this.formatTime(item.horaFin)),
            ) &&
            (item.cursoId === candidate.block.cursoId ||
              item.aulaId === candidate.block.aulaId),
        );
        if (conflict) {
          const resource =
            conflict.aulaId === candidate.block.aulaId ? "AULA" : "CURSO";
          throw new ConflictException({
            code: `CONFLICTO_${resource}`,
            message: `El ${resource.toLowerCase()} ya está ocupado en ese horario`,
            diaSemana: candidate.block.diaSemana,
            horaInicio: candidate.block.horaInicio,
            horaFin: candidate.block.horaFin,
            docente: `${conflict.docente.nombres} ${conflict.docente.apellidos}`,
            curso: conflict.curso.nombre,
            aula: conflict.aula?.nombre ?? null,
          });
        }
      }

      await tx.horarioClase.deleteMany({
        where: { configuracionId: config.id, docenteId },
      });
      if (dto.bloques.length) {
        await tx.horarioClase.createMany({
          data: dto.bloques.map((block) => ({
            configuracionId: config.id,
            docenteId,
            cursoId: block.cursoId,
            materiaId: block.materiaId,
            aulaId: block.aulaId,
            materia: subjectById.get(block.materiaId)!.nombre,
            diaSemana: block.diaSemana,
            horaInicio: this.parseTime(block.horaInicio),
            horaFin: this.parseTime(block.horaFin),
            creadoPor: actor.sub,
          })),
        });
      }
      const updatedConfig = await tx.configuracionHorario.update({
        where: { id: config.id },
        data: { version: { increment: 1 } },
      });
      await tx.auditoria.create({
        data: {
          usuarioId: actor.sub,
          accion: "MATRIZ_HORARIO_DOCENTE_GUARDADA",
          recurso: "horarios_clase",
          recursoId: docenteId,
          metadatos: {
            periodoId: dto.periodoId,
            cantidadBloques: dto.bloques.length,
            version: updatedConfig.version,
          },
        },
      });
      const saved = await tx.horarioClase.findMany({
        where: { configuracionId: config.id, docenteId, activo: true },
        include: scheduleRelations,
        orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
      });
      return {
        version: updatedConfig.version,
        bloques: saved.map((item) => this.blockResponse(item)),
      };
    });
  }

  async saveGeneralConfig(
    dto: SaveGeneralScheduleConfigDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockPeriod(tx, dto.periodoId);
      const period = await tx.periodoAcademico.findUnique({
        where: { id: dto.periodoId },
        select: { id: true },
      });
      if (!period)
        throw new NotFoundException("Periodo académico no encontrado");
      const current = await tx.configuracionHorario.findUnique({
        where: { periodoId: dto.periodoId },
      });
      if (
        (!current && dto.version !== 0) ||
        (current && current.version !== dto.version)
      )
        this.throwStaleVersion(current?.version ?? 0);

      const start = this.minutes(dto.horaInicio);
      const end = this.minutes(dto.horaFin);
      const breaks = dto.recreos.map((item) => ({
        ...item,
        start: this.minutes(item.horaInicio),
        end: this.minutes(item.horaFin),
      }));
      if (!IANAZone.isValidZone(dto.zonaHoraria.trim()))
        throw new BadRequestException("La zona horaria indicada no es válida");
      if (breaks.some((item) => item.nombre.trim().length < 2))
        throw new BadRequestException("Cada recreo debe tener un nombre");
      this.validateGeneralRange(start, end, dto.intervaloMinutos, breaks);

      if (current) {
        const schedules = await tx.horarioClase.findMany({
          where: { configuracionId: current.id, activo: true },
        });
        for (const schedule of schedules) {
          const blockStart = this.minutes(this.formatTime(schedule.horaInicio));
          const blockEnd = this.minutes(this.formatTime(schedule.horaFin));
          if (
            blockStart < start ||
            blockEnd > end ||
            breaks.some((item) =>
              this.overlaps(blockStart, blockEnd, item.start, item.end),
            )
          ) {
            throw new ConflictException({
              code: "CONFIGURACION_AFECTA_CLASES",
              message:
                "La nueva configuración deja clases fuera de rango o sobre un recreo",
            });
          }
        }
      }

      const config = current
        ? await tx.configuracionHorario.update({
            where: { id: current.id },
            data: {
              horaInicio: this.parseTime(dto.horaInicio),
              horaFin: this.parseTime(dto.horaFin),
              intervaloMinutos: dto.intervaloMinutos,
              toleranciaMinutos: dto.toleranciaMinutos,
              zonaHoraria: dto.zonaHoraria.trim(),
              version: { increment: 1 },
            },
          })
        : await tx.configuracionHorario.create({
            data: {
              periodoId: dto.periodoId,
              horaInicio: this.parseTime(dto.horaInicio),
              horaFin: this.parseTime(dto.horaFin),
              intervaloMinutos: dto.intervaloMinutos,
              toleranciaMinutos: dto.toleranciaMinutos,
              zonaHoraria: dto.zonaHoraria.trim(),
              version: 1,
            },
          });
      await tx.recreoHorario.deleteMany({
        where: { configuracionId: config.id },
      });
      if (breaks.length) {
        await tx.recreoHorario.createMany({
          data: breaks.map((item) => ({
            configuracionId: config.id,
            nombre: item.nombre.trim(),
            horaInicio: this.parseTime(item.horaInicio),
            horaFin: this.parseTime(item.horaFin),
          })),
        });
      }
      await tx.auditoria.create({
        data: {
          usuarioId: actor.sub,
          accion: "CONFIGURACION_HORARIO_GENERAL_GUARDADA",
          recurso: "configuraciones_horario",
          recursoId: config.id,
          metadatos: { periodoId: dto.periodoId, version: config.version },
        },
      });
      const saved = await tx.configuracionHorario.findUniqueOrThrow({
        where: { id: config.id },
        include: { recreos: { orderBy: { horaInicio: "asc" } } },
      });
      return {
        ...this.configResponse(saved),
        recreos: saved.recreos.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          horaInicio: this.formatTime(item.horaInicio),
          horaFin: this.formatTime(item.horaFin),
        })),
      };
    });
  }

  async create(dto: SaveTeachingScheduleDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const data = await this.validateLegacy(tx, dto);
      const schedule = await tx.horarioClase.create({
        data: { ...data, creadoPor: actor.sub },
        include: scheduleRelations,
      });
      await this.audit(tx, actor, "HORARIO_CLASE_CREADO", schedule.id);
      return this.toResponse(schedule);
    });
  }

  async update(
    id: string,
    dto: SaveTeachingScheduleDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.horarioClase.findUnique({ where: { id } });
      if (!current || !current.activo)
        throw new NotFoundException("Horario de clase no encontrado");
      const data = await this.validateLegacy(tx, dto, id);
      const schedule = await tx.horarioClase.update({
        where: { id },
        data,
        include: scheduleRelations,
      });
      await this.audit(tx, actor, "HORARIO_CLASE_ACTUALIZADO", id);
      return this.toResponse(schedule);
    });
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.horarioClase.updateMany({
        where: { id, activo: true },
        data: { activo: false },
      });
      if (!result.count)
        throw new NotFoundException("Horario de clase no encontrado");
      await this.audit(tx, actor, "HORARIO_CLASE_INACTIVADO", id);
    });
  }

  private async validateLegacy(
    tx: Prisma.TransactionClient,
    dto: SaveTeachingScheduleDto,
    currentId?: string,
  ) {
    const materia = dto.materia.trim();
    const config = await tx.configuracionHorario.findFirst({
      where: { periodo: { estado: EstadoPeriodo.ACTIVO } },
      include: { recreos: { where: { activo: true } } },
    });
    if (!config)
      throw new BadRequestException(
        "No existe configuración general de horario activa",
      );
    const block = {
      block: {
        cursoId: dto.cursoId,
        materiaId: "",
        aulaId: "",
        diaSemana: dto.diaSemana,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
      },
      start: this.minutes(dto.horaInicio),
      end: this.minutes(dto.horaFin),
    };
    this.validateBlocks([block], config);
    const [teacher, course, subject, conflict] = await Promise.all([
      tx.docente.findFirst({
        where: { id: dto.docenteId, estado: EstadoDocente.ACTIVO },
        select: { id: true },
      }),
      tx.curso.findFirst({
        where: { id: dto.cursoId, activo: true },
        select: { id: true },
      }),
      tx.materia.findFirst({
        where: {
          nombre: { equals: materia, mode: "insensitive" },
          activo: true,
        },
        select: { id: true },
      }),
      tx.horarioClase.findFirst({
        where: {
          configuracionId: config.id,
          activo: true,
          diaSemana: dto.diaSemana,
          ...(currentId ? { id: { not: currentId } } : {}),
          OR: [{ docenteId: dto.docenteId }, { cursoId: dto.cursoId }],
          horaInicio: { lt: this.parseTime(dto.horaFin) },
          horaFin: { gt: this.parseTime(dto.horaInicio) },
        },
        select: { id: true },
      }),
    ]);
    if (!teacher) throw new NotFoundException("Docente activo no encontrado");
    if (!course) throw new NotFoundException("Curso activo no encontrado");
    if (conflict)
      throw new ConflictException(
        "El docente o el curso ya tiene una clase en ese horario",
      );
    return {
      configuracionId: config.id,
      docenteId: dto.docenteId,
      cursoId: dto.cursoId,
      materiaId: subject?.id,
      materia,
      diaSemana: dto.diaSemana,
      horaInicio: this.parseTime(dto.horaInicio),
      horaFin: this.parseTime(dto.horaFin),
      activo: true,
    };
  }

  private validateBlocks(
    blocks: Array<{
      block: TeacherScheduleBlockDto;
      start: number;
      end: number;
    }>,
    config: {
      horaInicio: Date;
      horaFin: Date;
      intervaloMinutos: number;
      recreos: Array<{ horaInicio: Date; horaFin: Date }>;
    },
  ) {
    const rangeStart = this.minutes(this.formatTime(config.horaInicio));
    const rangeEnd = this.minutes(this.formatTime(config.horaFin));
    for (const item of blocks) {
      if (
        item.end <= item.start ||
        item.start < rangeStart ||
        item.end > rangeEnd ||
        (item.start - rangeStart) % config.intervaloMinutos !== 0 ||
        (item.end - rangeStart) % config.intervaloMinutos !== 0
      ) {
        throw new BadRequestException(
          "Los bloques deben respetar el rango general y los intervalos de 30 minutos",
        );
      }
      const breakConflict = config.recreos.some((recess) =>
        this.overlaps(
          item.start,
          item.end,
          this.minutes(this.formatTime(recess.horaInicio)),
          this.minutes(this.formatTime(recess.horaFin)),
        ),
      );
      if (breakConflict)
        throw new ConflictException({
          code: "CONFLICTO_RECREO_GENERAL",
          message: "Una clase no puede ocupar el recreo general",
          diaSemana: item.block.diaSemana,
          horaInicio: item.block.horaInicio,
          horaFin: item.block.horaFin,
        });
    }
    for (let left = 0; left < blocks.length; left += 1) {
      for (let right = left + 1; right < blocks.length; right += 1) {
        if (
          blocks[left].block.diaSemana === blocks[right].block.diaSemana &&
          this.overlaps(
            blocks[left].start,
            blocks[left].end,
            blocks[right].start,
            blocks[right].end,
          )
        ) {
          throw new ConflictException({
            code: "CONFLICTO_DOCENTE",
            message: "El docente tiene bloques superpuestos",
            diaSemana: blocks[left].block.diaSemana,
          });
        }
      }
    }
  }

  private validatePlannerBlocks(
    blocks: Array<{
      block: SchedulePlannerBlockDto;
      start: number;
      end: number;
    }>,
    config: {
      horaInicio: Date;
      horaFin: Date;
      intervaloMinutos: number;
      recreos: Array<{ horaInicio: Date; horaFin: Date }>;
    },
  ) {
    const rangeStart = this.minutes(this.formatTime(config.horaInicio));
    const rangeEnd = this.minutes(this.formatTime(config.horaFin));
    for (const item of blocks) {
      if (
        item.end <= item.start ||
        item.start < rangeStart ||
        item.end > rangeEnd ||
        (item.start - rangeStart) % config.intervaloMinutos !== 0 ||
        (item.end - rangeStart) % config.intervaloMinutos !== 0
      )
        throw new BadRequestException(
          "Los bloques deben respetar la jornada y sus intervalos de 30 minutos",
        );
      if (
        config.recreos.some((recess) =>
          this.overlaps(
            item.start,
            item.end,
            this.minutes(this.formatTime(recess.horaInicio)),
            this.minutes(this.formatTime(recess.horaFin)),
          ),
        )
      )
        throw new ConflictException({
          code: "CONFLICTO_RECREO_GENERAL",
          message: "Una clase no puede ocupar el recreo general",
          diaSemana: item.block.diaSemana,
        });
    }
    for (let left = 0; left < blocks.length; left += 1) {
      for (let right = left + 1; right < blocks.length; right += 1) {
        const first = blocks[left];
        const second = blocks[right];
        if (
          first.block.diaSemana !== second.block.diaSemana ||
          !this.overlaps(first.start, first.end, second.start, second.end)
        )
          continue;
        const conflict =
          first.block.docenteId === second.block.docenteId
            ? ["DOCENTE", "El docente"]
            : first.block.cursoId === second.block.cursoId
              ? ["CURSO", "El curso"]
              : first.block.aulaId === second.block.aulaId
                ? ["AULA", "El aula"]
                : null;
        if (conflict)
          throw new ConflictException({
            code: `CONFLICTO_${conflict[0]}`,
            message: `${conflict[1]} tiene bloques superpuestos`,
            diaSemana: first.block.diaSemana,
            horaInicio: first.block.horaInicio,
            horaFin: first.block.horaFin,
          });
      }
    }
  }

  private validateGeneralRange(
    start: number,
    end: number,
    interval: number,
    breaks: Array<{ start: number; end: number }>,
  ) {
    if (end <= start || (end - start) % interval !== 0)
      throw new BadRequestException(
        "El rango general debe dividirse en intervalos completos de 30 minutos",
      );
    for (const item of breaks) {
      if (
        item.end <= item.start ||
        item.start < start ||
        item.end > end ||
        (item.start - start) % interval !== 0 ||
        (item.end - start) % interval !== 0
      )
        throw new BadRequestException(
          "Cada recreo debe respetar el rango y los intervalos generales",
        );
    }
    for (let left = 0; left < breaks.length; left += 1) {
      for (let right = left + 1; right < breaks.length; right += 1) {
        if (
          this.overlaps(
            breaks[left].start,
            breaks[left].end,
            breaks[right].start,
            breaks[right].end,
          )
        )
          throw new ConflictException(
            "Los recreos generales no pueden superponerse",
          );
      }
    }
  }

  private throwStaleVersion(currentVersion: number): never {
    throw new ConflictException({
      code: "VERSION_OBSOLETA",
      message: "El horario cambió en otra sesión. Recargue antes de guardar",
      versionActual: currentVersion,
    });
  }

  private async lockPeriod(tx: Prisma.TransactionClient, periodId: string) {
    await tx.$queryRaw(
      Prisma.sql`
        SELECT 1 AS locked
        FROM (SELECT pg_advisory_xact_lock(hashtext(${periodId}))) AS period_lock
      `,
    );
  }

  private overlaps(startA: number, endA: number, startB: number, endB: number) {
    return startA < endB && endA > startB;
  }

  private assignmentKey(
    courseId: string,
    subjectId: string,
    teacherId: string,
  ) {
    return `${courseId}|${subjectId}|${teacherId}`;
  }

  private minutes(value: string): number {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private parseTime(value: string): Date {
    return new Date(`1970-01-01T${value}:00.000Z`);
  }

  private formatTime(value: Date): string {
    return value.toISOString().slice(11, 16);
  }

  private configResponse(config: {
    id: string;
    periodoId: string;
    horaInicio: Date;
    horaFin: Date;
    intervaloMinutos: number;
    toleranciaMinutos: number;
    zonaHoraria: string;
    version: number;
  }) {
    return {
      id: config.id,
      periodoId: config.periodoId,
      horaInicio: this.formatTime(config.horaInicio),
      horaFin: this.formatTime(config.horaFin),
      intervaloMinutos: config.intervaloMinutos,
      toleranciaMinutos: config.toleranciaMinutos,
      zonaHoraria: config.zonaHoraria,
      version: config.version,
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    action: string,
    resourceId: string,
  ) {
    return tx.auditoria.create({
      data: {
        usuarioId: actor.sub,
        accion: action,
        recurso: "horarios_clase",
        recursoId: resourceId,
      },
    });
  }

  private blockResponse(schedule: TeachingScheduleWithRelations) {
    const assignment = schedule.asignacion;
    return {
      id: schedule.id,
      asignacionId: assignment?.id ?? null,
      cursoId: assignment?.cursoId ?? schedule.cursoId,
      cursoNombre: assignment?.curso.nombre ?? schedule.curso.nombre,
      materiaId: assignment?.materiaId ?? schedule.materiaId,
      materiaNombre:
        assignment?.materia.nombre ??
        schedule.materiaCatalogo?.nombre ??
        schedule.materia,
      aulaId: schedule.aulaId,
      aulaNombre: schedule.aula?.nombre ?? null,
      diaSemana: schedule.diaSemana,
      horaInicio: this.formatTime(schedule.horaInicio),
      horaFin: this.formatTime(schedule.horaFin),
    };
  }

  private plannerBlockResponse(schedule: TeachingScheduleWithRelations) {
    const teacher = schedule.asignacion?.docente ?? schedule.docente;
    return {
      ...this.blockResponse(schedule),
      docenteId: teacher.id,
      docenteNombre: `${teacher.nombres} ${teacher.apellidos}`,
      docenteEspecialidad: teacher.especialidad,
      docenteFotografiaUrl: teacher.fotografiaUrl,
    };
  }

  private toResponse(schedule: TeachingScheduleWithRelations) {
    const assignment = schedule.asignacion;
    const teacher = assignment?.docente ?? schedule.docente;
    const course = assignment?.curso ?? schedule.curso;
    return {
      id: schedule.id,
      materia:
        assignment?.materia.nombre ??
        schedule.materiaCatalogo?.nombre ??
        schedule.materia,
      materiaId: assignment?.materiaId ?? schedule.materiaId,
      aula: schedule.aula
        ? {
            id: schedule.aula.id,
            nombre: schedule.aula.nombre,
          }
        : null,
      diaSemana: schedule.diaSemana,
      horaInicio: this.formatTime(schedule.horaInicio),
      horaFin: this.formatTime(schedule.horaFin),
      activo: schedule.activo,
      docente: {
        id: teacher.id,
        codigo: teacher.codigoDocente,
        nombreCompleto: `${teacher.nombres} ${teacher.apellidos}`,
        especialidad: teacher.especialidad,
        telefono: teacher.telefono,
      },
      curso: { id: course.id, nombre: course.nombre },
    };
  }
}
