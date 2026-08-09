import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { AuthenticatedUser } from "../../../comun/seguridad/authenticated-user";
import {
  SaveClassroomDto,
  SaveSubjectDto,
} from "../aplicacion/dto/save-schedule-catalog.dto";

@Injectable()
export class ScheduleCatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  listSubjects() {
    return this.prisma.materia.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
  }

  saveSubject(dto: SaveSubjectDto, actor: AuthenticatedUser, id?: string) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.materia.findFirst({
        where: {
          id: id ? { not: id } : undefined,
          OR: [
            { codigo: { equals: dto.codigo.trim(), mode: "insensitive" } },
            { nombre: { equals: dto.nombre.trim(), mode: "insensitive" } },
          ],
        },
      });
      if (duplicate)
        throw new ConflictException(
          "Ya existe una materia con ese código o nombre",
        );
      if (id) {
        const current = await tx.materia.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Materia no encontrada");
      }
      const subject = id
        ? await tx.materia.update({
            where: { id },
            data: {
              codigo: dto.codigo.trim().toUpperCase(),
              nombre: dto.nombre.trim().toUpperCase(),
              activo: true,
            },
          })
        : await tx.materia.create({
            data: {
              codigo: dto.codigo.trim().toUpperCase(),
              nombre: dto.nombre.trim().toUpperCase(),
            },
          });
      await this.audit(
        tx,
        actor,
        id ? "MATERIA_ACTUALIZADA" : "MATERIA_CREADA",
        "materias",
        subject.id,
      );
      return subject;
    });
  }

  deactivateSubject(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.materia.updateMany({
        where: { id, activo: true },
        data: { activo: false },
      });
      if (!result.count) throw new NotFoundException("Materia no encontrada");
      await this.audit(tx, actor, "MATERIA_INACTIVADA", "materias", id);
    });
  }

  listClassrooms() {
    return this.prisma.aula.findMany({
      where: { activo: true },
      orderBy: [{ codigo: "asc" }, { nombre: "asc" }],
    });
  }

  saveClassroom(dto: SaveClassroomDto, actor: AuthenticatedUser, id?: string) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.aula.findFirst({
        where: {
          id: id ? { not: id } : undefined,
          codigo: { equals: dto.codigo.trim(), mode: "insensitive" },
        },
      });
      if (duplicate)
        throw new ConflictException("Ya existe un aula con ese código");
      if (id) {
        const current = await tx.aula.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Aula no encontrada");
      }
      const classroom = id
        ? await tx.aula.update({
            where: { id },
            data: {
              codigo: dto.codigo.trim().toUpperCase(),
              nombre: dto.nombre.trim(),
              capacidad: dto.capacidad,
              ubicacion: dto.ubicacion?.trim() || null,
              activo: true,
            },
          })
        : await tx.aula.create({
            data: {
              codigo: dto.codigo.trim().toUpperCase(),
              nombre: dto.nombre.trim(),
              capacidad: dto.capacidad,
              ubicacion: dto.ubicacion?.trim() || null,
            },
          });
      await this.audit(
        tx,
        actor,
        id ? "AULA_ACTUALIZADA" : "AULA_CREADA",
        "aulas",
        classroom.id,
      );
      return classroom;
    });
  }

  deactivateClassroom(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.aula.updateMany({
        where: { id, activo: true },
        data: { activo: false },
      });
      if (!result.count) throw new NotFoundException("Aula no encontrada");
      await this.audit(tx, actor, "AULA_INACTIVADA", "aulas", id);
    });
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    action: string,
    resource: string,
    resourceId: string,
  ) {
    return tx.auditoria.create({
      data: {
        usuarioId: actor.sub,
        accion: action,
        recurso: resource,
        recursoId: resourceId,
      },
    });
  }
}
