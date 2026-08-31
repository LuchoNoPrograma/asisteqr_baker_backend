import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EstadoCredencial,
  EstadoEstudiante,
  EstadoInscripcion,
  EstadoPeriodo,
  Prisma,
} from "@prisma/client";
import { DateTime } from "luxon";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CreateStudentDto } from "../aplicacion/dto/create-student.dto";
import { UpdateStudentDto } from "../aplicacion/dto/update-student.dto";

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(buscar?: string, cursoId?: number) {
    const term = buscar?.trim();
    const numericCode = term && /^\d+$/.test(term) ? Number(term) : undefined;
    const students = await this.prisma.estudiante.findMany({
      where: {
        ...(term
          ? {
              OR: [
                { nombres: { contains: term, mode: "insensitive" as const } },
                { apellidos: { contains: term, mode: "insensitive" as const } },
                {
                  numeroDocumento: {
                    contains: term,
                    mode: "insensitive" as const,
                  },
                },
                ...(numericCode ? [{ codigoEstudiante: numericCode }] : []),
              ],
            }
          : {}),
        ...(cursoId
          ? {
              inscripciones: {
                some: { cursoId, estado: EstadoInscripcion.ACTIVA },
              },
            }
          : {}),
      },
      include: {
        inscripciones: {
          where: {
            estado: EstadoInscripcion.ACTIVA,
            periodo: { estado: EstadoPeriodo.ACTIVO },
          },
          include: { curso: true },
          take: 1,
        },
      },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      take: 200,
    });
    return students.map((student) => this.toResponse(student));
  }

  async get(id: number) {
    const student = await this.prisma.estudiante.findUnique({
      where: { id },
      include: {
        inscripciones: {
          where: { estado: EstadoInscripcion.ACTIVA },
          include: { curso: true, periodo: true },
          orderBy: { creadoEn: "desc" },
          take: 1,
        },
      },
    });
    if (!student) throw new NotFoundException("Estudiante no encontrado");
    return this.toResponse(student);
  }

  async create(dto: CreateStudentDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [course, period] = await Promise.all([
          tx.curso.findFirst({ where: { id: dto.cursoId, activo: true } }),
          tx.periodoAcademico.findFirst({
            where: { estado: EstadoPeriodo.ACTIVO },
          }),
        ]);
        if (!course) throw new NotFoundException("Curso no encontrado");
        if (!period)
          throw new NotFoundException("No existe un periodo académico activo");
        const student = await tx.estudiante.create({
          data: {
            nombres: dto.nombres.trim(),
            apellidos: dto.apellidos.trim(),
            numeroDocumento: this.optional(dto.numeroDocumento),
            fechaNacimiento: this.birthDate(dto.fechaNacimiento),
            nombreTutor: dto.nombreTutor.trim(),
            telefonoTutor: this.optional(dto.telefonoTutor),
            fotografiaUrl: this.optional(dto.fotografiaUrl),
            inscripciones: {
              create: {
                cursoId: course.id,
                periodoId: period.id,
                vigenteDesde: this.effectiveDate(period),
              },
            },
          },
          include: { inscripciones: { include: { curso: true }, take: 1 } },
        });
        await tx.auditoria.create({
          data: {
            usuarioId: actor.sub,
            accion: "ESTUDIANTE_CREADO",
            recurso: "estudiantes",
            recursoId: student.id,
          },
        });
        return this.toResponse(student);
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async update(id: number, dto: UpdateStudentDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.estudiante.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Estudiante no encontrado");
        await tx.estudiante.update({
          where: { id },
          data: {
            ...(dto.nombres ? { nombres: dto.nombres.trim() } : {}),
            ...(dto.apellidos ? { apellidos: dto.apellidos.trim() } : {}),
            ...(dto.numeroDocumento !== undefined
              ? { numeroDocumento: this.optional(dto.numeroDocumento) }
              : {}),
            ...(dto.fechaNacimiento !== undefined
              ? {
                  fechaNacimiento: this.birthDate(dto.fechaNacimiento),
                }
              : {}),
            ...(dto.nombreTutor !== undefined
              ? { nombreTutor: dto.nombreTutor.trim() }
              : {}),
            ...(dto.telefonoTutor !== undefined
              ? { telefonoTutor: this.optional(dto.telefonoTutor) }
              : {}),
            ...(dto.fotografiaUrl !== undefined
              ? { fotografiaUrl: this.optional(dto.fotografiaUrl) }
              : {}),
          },
        });
        if (dto.cursoId) {
          const [course, period] = await Promise.all([
            tx.curso.findFirst({ where: { id: dto.cursoId, activo: true } }),
            tx.periodoAcademico.findFirst({
              where: { estado: EstadoPeriodo.ACTIVO },
            }),
          ]);
          if (!course) throw new NotFoundException("Curso no encontrado");
          if (!period)
            throw new NotFoundException(
              "No existe un periodo académico activo",
            );
          const effectiveDate = this.effectiveDate(period);
          const currentEnrollment = await tx.inscripcion.findFirst({
            where: {
              estudianteId: id,
              periodoId: period.id,
              estado: EstadoInscripcion.ACTIVA,
              vigenteHasta: null,
            },
          });
          if (!currentEnrollment) {
            await tx.inscripcion.create({
              data: {
                estudianteId: id,
                periodoId: period.id,
                cursoId: course.id,
                vigenteDesde: effectiveDate,
              },
            });
          } else if (currentEnrollment.cursoId !== course.id) {
            if (
              currentEnrollment.vigenteDesde.getTime() ===
              effectiveDate.getTime()
            ) {
              await tx.inscripcion.update({
                where: { id: currentEnrollment.id },
                data: { cursoId: course.id },
              });
            } else {
              await tx.inscripcion.update({
                where: { id: currentEnrollment.id },
                data: {
                  estado: EstadoInscripcion.RETIRADA,
                  vigenteHasta: effectiveDate,
                },
              });
              await tx.inscripcion.create({
                data: {
                  estudianteId: id,
                  periodoId: period.id,
                  cursoId: course.id,
                  vigenteDesde: effectiveDate,
                },
              });
            }
          }
        }
        await tx.auditoria.create({
          data: {
            usuarioId: actor.sub,
            accion: "ESTUDIANTE_ACTUALIZADO",
            recurso: "estudiantes",
            recursoId: id,
          },
        });
        const updated = await tx.estudiante.findUniqueOrThrow({
          where: { id },
          include: {
            inscripciones: {
              where: { estado: EstadoInscripcion.ACTIVA },
              include: { curso: true },
              orderBy: { creadoEn: "desc" },
              take: 1,
            },
          },
        });
        return this.toResponse(updated);
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const student = await tx.estudiante.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!student) throw new NotFoundException("Estudiante no encontrado");

        const enrollments = await tx.inscripcion.findMany({
          where: { estudianteId: id, estado: EstadoInscripcion.ACTIVA },
          select: { id: true, vigenteDesde: true },
        });
        const effectiveDate = this.today();

        await Promise.all([
          tx.estudiante.update({
            where: { id },
            data: { estado: EstadoEstudiante.RETIRADO },
          }),
          ...enrollments.map((enrollment) =>
            tx.inscripcion.update({
              where: { id: enrollment.id },
              data: {
                estado: EstadoInscripcion.RETIRADA,
                vigenteHasta:
                  enrollment.vigenteDesde > effectiveDate
                    ? enrollment.vigenteDesde
                    : effectiveDate,
              },
            }),
          ),
          tx.credencialQr.updateMany({
            where: { estudianteId: id, estado: EstadoCredencial.ACTIVA },
            data: { estado: EstadoCredencial.REVOCADA },
          }),
          tx.auditoria.create({
            data: {
              usuarioId: actor.sub,
              accion: "ESTUDIANTE_RETIRADO",
              recurso: "estudiantes",
              recursoId: id,
            },
          }),
        ]);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private toResponse(student: {
    id: number;
    codigoEstudiante: number;
    numeroDocumento: string | null;
    nombres: string;
    apellidos: string;
    fechaNacimiento: Date | null;
    nombreTutor: string | null;
    telefonoTutor: string | null;
    fotografiaUrl: string | null;
    estado: EstadoEstudiante;
    inscripciones: Array<{ curso: { id: number; nombre: string } }>;
  }) {
    const course = student.inscripciones[0]?.curso;
    return {
      id: student.id,
      codigoEstudiante: student.codigoEstudiante,
      numeroDocumento: student.numeroDocumento,
      nombres: student.nombres,
      apellidos: student.apellidos,
      nombreCompleto: `${student.nombres} ${student.apellidos}`,
      fechaNacimiento: student.fechaNacimiento?.toISOString().slice(0, 10),
      nombreTutor: student.nombreTutor,
      telefonoTutor: student.telefonoTutor,
      fotografiaUrl: student.fotografiaUrl,
      estado: student.estado,
      curso: course ?? null,
    };
  }

  private optional(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private birthDate(value: string): Date {
    const date = new Date(value + "T00:00:00.000Z");
    const today = new Date();
    const earliest = new Date("1900-01-01T00:00:00.000Z");
    if (date < earliest || date > today) {
      throw new BadRequestException("Fecha de nacimiento no válida");
    }
    return date;
  }

  private effectiveDate(period: { fechaInicio: Date; fechaFin: Date }): Date {
    const today = this.today();
    if (today < period.fechaInicio) return period.fechaInicio;
    if (today > period.fechaFin)
      return DateTime.fromJSDate(period.fechaFin, { zone: "utc" })
        .plus({ days: 1 })
        .toJSDate();
    return today;
  }

  private today(): Date {
    const local = DateTime.now().setZone("America/La_Paz");
    return DateTime.utc(local.year, local.month, local.day).toJSDate();
  }

  private rethrowConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictException("El número de documento ya está registrado");
    throw error;
  }
}
