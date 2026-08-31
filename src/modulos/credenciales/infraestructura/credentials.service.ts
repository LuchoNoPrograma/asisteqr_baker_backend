import { Injectable, InternalServerErrorException } from "@nestjs/common";
import {
  EstadoCredencial,
  EstadoEstudiante,
  EstadoInscripcion,
  EstadoPeriodo,
} from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";

@Injectable()
export class CredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  async printable() {
    const students = await this.prisma.estudiante.findMany({
      where: {
        estado: EstadoEstudiante.ACTIVO,
        inscripciones: {
          some: {
            estado: EstadoInscripcion.ACTIVA,
            periodo: { estado: EstadoPeriodo.ACTIVO },
          },
        },
      },
      select: {
        id: true,
        codigoEstudiante: true,
        nombres: true,
        apellidos: true,
        nombreTutor: true,
        telefonoTutor: true,
        fotografiaUrl: true,
        estado: true,
        inscripciones: {
          where: {
            estado: EstadoInscripcion.ACTIVA,
            periodo: { estado: EstadoPeriodo.ACTIVO },
          },
          select: {
            curso: {
              select: { id: true, nombre: true, gestion: true },
            },
          },
          take: 1,
        },
      },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      take: 200,
    });

    const studentIds = students.map(({ id }) => id);
    let credentials = await this.activeCredentials(studentIds);
    const credentialByStudent = new Map(
      credentials.map((credential) => [credential.estudianteId, credential]),
    );
    const missingStudentIds = studentIds.filter(
      (studentId) => !credentialByStudent.has(studentId),
    );
    if (missingStudentIds.length > 0) {
      await this.prisma.credencialQr.createMany({
        data: missingStudentIds.map((estudianteId) => ({
          estudianteId,
          esPrincipal: true,
          version: 3,
          estado: EstadoCredencial.ACTIVA,
        })),
        skipDuplicates: true,
      });
      credentials = await this.activeCredentials(studentIds);
    }
    const finalCredentialByStudent = new Map(
      credentials.map((credential) => [credential.estudianteId, credential]),
    );

    return students.map((student) => {
      const credential = finalCredentialByStudent.get(student.id);
      if (!credential)
        throw new InternalServerErrorException(
          "No se pudo preparar la credencial del estudiante",
        );
      const course = student.inscripciones[0]?.curso ?? null;
      return {
        estudiante: {
          id: student.id,
          codigoEstudiante: student.codigoEstudiante,
          nombres: student.nombres,
          apellidos: student.apellidos,
          nombreCompleto: `${student.nombres} ${student.apellidos}`,
          nombreTutor: student.nombreTutor,
          telefonoTutor: student.telefonoTutor,
          fotografiaUrl: student.fotografiaUrl,
          estado: student.estado,
          curso: course,
        },
        tokenQr: this.tokenFor(credential.id),
      };
    });
  }

  private activeCredentials(studentIds: number[]) {
    if (studentIds.length === 0) return Promise.resolve([]);
    return this.prisma.credencialQr.findMany({
      where: {
        estudianteId: { in: studentIds },
        estado: EstadoCredencial.ACTIVA,
        esPrincipal: true,
      },
      select: { id: true, estudianteId: true },
      orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
    });
  }

  private tokenFor(credentialId: number): string {
    return `AQB1.v1_${credentialId}`;
  }
}
