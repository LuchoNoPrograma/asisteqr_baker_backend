import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EstadoCredencial,
  EstadoEstudiante,
  EstadoInscripcion,
  EstadoPeriodo,
} from "@prisma/client";
import { createHash, createHmac } from "node:crypto";
import { PrismaService } from "../../../comun/prisma/prisma.service";

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

    const entries = students.map((student) => {
      const tokenQr = this.tokenFor(student.id);
      return {
        student,
        tokenQr,
        tokenHash: createHash("sha256").update(tokenQr).digest("hex"),
      };
    });

    if (entries.length > 0) {
      await this.prisma.$transaction(
        entries.map(({ student, tokenHash }) =>
          this.prisma.credencialQr.upsert({
            where: { tokenHash },
            update: {
              estudianteId: student.id,
              estado: EstadoCredencial.ACTIVA,
              vigenteHasta: null,
            },
            create: {
              estudianteId: student.id,
              tokenHash,
              version: 2,
              estado: EstadoCredencial.ACTIVA,
            },
          }),
        ),
      );
    }

    return entries.map(({ student, tokenQr }) => {
      const course = student.inscripciones[0]?.curso ?? null;
      return {
        estudiante: {
          id: student.id,
          codigoEstudiante: student.codigoEstudiante,
          nombres: student.nombres,
          apellidos: student.apellidos,
          nombreCompleto: `${student.nombres} ${student.apellidos}`,
          fotografiaUrl: student.fotografiaUrl,
          estado: student.estado,
          curso: course,
        },
        tokenQr,
      };
    });
  }

  private tokenFor(studentId: string): string {
    const secret = this.config.getOrThrow<string>("QR_TOKEN_SECRET");
    const signature = createHmac("sha256", secret)
      .update(`credencial:v2:${studentId}`)
      .digest("base64url");
    return `AQB1.v2_${signature}`;
  }
}
