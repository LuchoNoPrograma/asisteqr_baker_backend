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

  saveSubject(dto: SaveSubjectDto, actor: AuthenticatedUser, id?: number) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.materia.findFirst({
        where: {
          id: id ? { not: id } : undefined,
          nombre: { equals: dto.nombre.trim(), mode: "insensitive" },
        },
      });
      if (duplicate)
        throw new ConflictException("Ya existe una materia con ese nombre");
      if (id) {
        const current = await tx.materia.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Materia no encontrada");
      }
      const subject = id
        ? await tx.materia.update({
            where: { id },
            data: {
              nombre: dto.nombre.trim().toUpperCase(),
              activo: true,
            },
          })
        : await tx.materia.create({
            data: {
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

  deactivateSubject(id: number, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const [assignmentCount, blockCount] = await Promise.all([
        tx.asignacionAcademica.count({
          where: { materiaId: id, activo: true },
        }),
        tx.horarioClase.count({ where: { materiaId: id, activo: true } }),
      ]);
      if (assignmentCount || blockCount)
        throw new ConflictException(
          "La materia tiene asignaciones o clases activas y no puede desactivarse",
        );
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
      orderBy: { nombre: "asc" },
    });
  }

  saveClassroom(dto: SaveClassroomDto, actor: AuthenticatedUser, id?: number) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.aula.findFirst({
        where: {
          id: id ? { not: id } : undefined,
          nombre: { equals: dto.nombre.trim(), mode: "insensitive" },
        },
      });
      if (duplicate)
        throw new ConflictException("Ya existe un aula con ese nombre");
      if (id) {
        const current = await tx.aula.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Aula no encontrada");
      }
      const classroom = id
        ? await tx.aula.update({
            where: { id },
            data: {
              nombre: dto.nombre.trim(),
              capacidad: dto.capacidad,
              ubicacion: dto.ubicacion?.trim() || null,
              activo: true,
            },
          })
        : await tx.aula.create({
            data: {
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

  deactivateClassroom(id: number, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const blockCount = await tx.horarioClase.count({
        where: { aulaId: id, activo: true },
      });
      if (blockCount)
        throw new ConflictException(
          "El aula tiene clases activas y no puede desactivarse",
        );
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
    resourceId: number,
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
