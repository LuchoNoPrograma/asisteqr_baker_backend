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
  SaveTeacherScheduleMatrixDto,
  TeacherScheduleBlockDto,
} from "../aplicacion/dto/save-teacher-schedule-matrix.dto";
import { SaveTeachingScheduleDto } from "../aplicacion/dto/save-teaching-schedule.dto";

const scheduleRelations = {
  docente: true,
  curso: true,
  materiaCatalogo: true,
  aula: true,
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
        orderBy: [{ codigo: "asc" }, { nombre: "asc" }],
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
        codigo: item.codigo,
        nombre: item.nombre,
      })),
      aulas: classrooms.map((item) => ({
        id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
        capacidad: item.capacidad,
        ubicacion: item.ubicacion,
      })),
      bloques: config.horariosClase.map((item) => this.blockResponse(item)),
    };
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
        await Promise.all(
          [...courseIds].map((cursoId) =>
            tx.docenteCurso.upsert({
              where: { docenteId_cursoId: { docenteId, cursoId } },
              update: {},
              create: { docenteId, cursoId },
            }),
          ),
        );
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
      await Promise.all([
        tx.docenteCurso.upsert({
          where: {
            docenteId_cursoId: {
              docenteId: dto.docenteId,
              cursoId: dto.cursoId,
            },
          },
          update: {},
          create: { docenteId: dto.docenteId, cursoId: dto.cursoId },
        }),
        this.audit(tx, actor, "HORARIO_CLASE_CREADO", schedule.id),
      ]);
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
    return {
      id: schedule.id,
      cursoId: schedule.cursoId,
      cursoNombre: schedule.curso.nombre,
      materiaId: schedule.materiaId,
      materiaNombre: schedule.materiaCatalogo?.nombre ?? schedule.materia,
      aulaId: schedule.aulaId,
      aulaNombre: schedule.aula?.nombre ?? null,
      aulaCodigo: schedule.aula?.codigo ?? null,
      diaSemana: schedule.diaSemana,
      horaInicio: this.formatTime(schedule.horaInicio),
      horaFin: this.formatTime(schedule.horaFin),
    };
  }

  private toResponse(schedule: TeachingScheduleWithRelations) {
    return {
      id: schedule.id,
      materia: schedule.materiaCatalogo?.nombre ?? schedule.materia,
      materiaId: schedule.materiaId,
      aula: schedule.aula
        ? {
            id: schedule.aula.id,
            codigo: schedule.aula.codigo,
            nombre: schedule.aula.nombre,
          }
        : null,
      diaSemana: schedule.diaSemana,
      horaInicio: this.formatTime(schedule.horaInicio),
      horaFin: this.formatTime(schedule.horaFin),
      activo: schedule.activo,
      docente: {
        id: schedule.docente.id,
        codigo: schedule.docente.codigoDocente,
        nombreCompleto: `${schedule.docente.nombres} ${schedule.docente.apellidos}`,
        especialidad: schedule.docente.especialidad,
        telefono: schedule.docente.telefono,
      },
      curso: { id: schedule.curso.id, nombre: schedule.curso.nombre },
    };
  }
}
