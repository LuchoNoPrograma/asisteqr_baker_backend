import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EstadoDocente, Prisma } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import { CreateTeacherDto } from "../aplicacion/dto/create-teacher.dto";
import { UpdateTeacherDto } from "../aplicacion/dto/update-teacher.dto";

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(buscar?: string, cursoId?: string) {
    const term = buscar?.trim();
    const numericCode = term && /^\d+$/.test(term) ? Number(term) : undefined;
    const teachers = await this.prisma.docente.findMany({
      where: {
        ...(term
          ? {
              OR: [
                { nombres: { contains: term, mode: "insensitive" as const } },
                { apellidos: { contains: term, mode: "insensitive" as const } },
                { correo: { contains: term, mode: "insensitive" as const } },
                {
                  especialidad: {
                    contains: term,
                    mode: "insensitive" as const,
                  },
                },
                {
                  numeroDocumento: {
                    contains: term,
                    mode: "insensitive" as const,
                  },
                },
                ...(numericCode ? [{ codigoDocente: numericCode }] : []),
              ],
            }
          : {}),
        ...(cursoId ? { cursos: { some: { cursoId } } } : {}),
      },
      include: { cursos: { include: { curso: true } } },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      take: 200,
    });
    return teachers.map((teacher) => this.toResponse(teacher));
  }

  async get(id: string) {
    const teacher = await this.prisma.docente.findUnique({
      where: { id },
      include: { cursos: { include: { curso: true } } },
    });
    if (!teacher) throw new NotFoundException("Docente no encontrado");
    return this.toResponse(teacher);
  }

  async create(dto: CreateTeacherDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCourses(tx, dto.cursoIds);
        const teacher = await tx.docente.create({
          data: {
            nombres: dto.nombres.trim(),
            apellidos: dto.apellidos.trim(),
            numeroDocumento: this.optional(dto.numeroDocumento),
            especialidad: dto.especialidad.trim(),
            correo: this.optional(dto.correo)?.toLowerCase() ?? null,
            telefono: this.optional(dto.telefono),
            fotografiaUrl: this.optional(dto.fotografiaUrl),
            creadoPor: actor.sub,
            cursos: {
              create: dto.cursoIds.map((cursoId) => ({ cursoId })),
            },
          },
          include: { cursos: { include: { curso: true } } },
        });
        await tx.auditoria.create({
          data: {
            usuarioId: actor.sub,
            accion: "DOCENTE_CREADO",
            recurso: "docentes",
            recursoId: teacher.id,
          },
        });
        return this.toResponse(teacher);
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async update(id: string, dto: UpdateTeacherDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.docente.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Docente no encontrado");
        if (dto.cursoIds) await this.ensureCourses(tx, dto.cursoIds);
        await tx.docente.update({
          where: { id },
          data: {
            ...(dto.nombres ? { nombres: dto.nombres.trim() } : {}),
            ...(dto.apellidos ? { apellidos: dto.apellidos.trim() } : {}),
            ...(dto.numeroDocumento !== undefined
              ? { numeroDocumento: this.optional(dto.numeroDocumento) }
              : {}),
            ...(dto.especialidad !== undefined
              ? { especialidad: dto.especialidad.trim() }
              : {}),
            ...(dto.correo !== undefined
              ? { correo: this.optional(dto.correo)?.toLowerCase() ?? null }
              : {}),
            ...(dto.telefono !== undefined
              ? { telefono: this.optional(dto.telefono) }
              : {}),
            ...(dto.fotografiaUrl !== undefined
              ? { fotografiaUrl: this.optional(dto.fotografiaUrl) }
              : {}),
            ...(dto.estado ? { estado: dto.estado } : {}),
            actualizadoPor: actor.sub,
            ...(dto.cursoIds
              ? {
                  cursos: {
                    deleteMany: {},
                    create: dto.cursoIds.map((cursoId) => ({ cursoId })),
                  },
                }
              : {}),
          },
        });
        await tx.auditoria.create({
          data: {
            usuarioId: actor.sub,
            accion: "DOCENTE_ACTUALIZADO",
            recurso: "docentes",
            recursoId: id,
          },
        });
        const teacher = await tx.docente.findUniqueOrThrow({
          where: { id },
          include: { cursos: { include: { curso: true } } },
        });
        return this.toResponse(teacher);
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.docente.updateMany({
        where: { id },
        data: { estado: EstadoDocente.INACTIVO, actualizadoPor: actor.sub },
      });
      if (!result.count) throw new NotFoundException("Docente no encontrado");
      await tx.auditoria.create({
        data: {
          usuarioId: actor.sub,
          accion: "DOCENTE_INACTIVADO",
          recurso: "docentes",
          recursoId: id,
        },
      });
    });
  }

  private async ensureCourses(
    tx: Prisma.TransactionClient,
    courseIds: string[],
  ): Promise<void> {
    if (!courseIds.length) return;
    const count = await tx.curso.count({
      where: { id: { in: courseIds }, activo: true },
    });
    if (count !== courseIds.length)
      throw new NotFoundException("Uno o más cursos no existen");
  }

  private toResponse(teacher: {
    id: string;
    codigoDocente: number;
    numeroDocumento: string | null;
    nombres: string;
    apellidos: string;
    especialidad: string;
    correo: string | null;
    telefono: string | null;
    fotografiaUrl: string | null;
    estado: EstadoDocente;
    cursos: Array<{ curso: { id: string; nombre: string } }>;
  }) {
    return {
      id: teacher.id,
      codigoDocente: teacher.codigoDocente,
      numeroDocumento: teacher.numeroDocumento,
      nombres: teacher.nombres,
      apellidos: teacher.apellidos,
      especialidad: teacher.especialidad,
      nombreCompleto: `${teacher.nombres} ${teacher.apellidos}`,
      correo: teacher.correo,
      telefono: teacher.telefono,
      fotografiaUrl: teacher.fotografiaUrl,
      estado: teacher.estado,
      cursos: teacher.cursos.map(({ curso }) => curso),
    };
  }

  private optional(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private rethrowConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictException(
        "El documento o correo del docente ya está registrado",
      );
    throw error;
  }
}
