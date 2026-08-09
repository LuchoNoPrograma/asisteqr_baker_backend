import { Injectable, NotFoundException } from "@nestjs/common";
import { EstadoPeriodo } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async active() {
    const period = await this.prisma.periodoAcademico.findFirst({
      where: { estado: EstadoPeriodo.ACTIVO },
      orderBy: [{ fechaInicio: "desc" }, { creadoEn: "desc" }],
    });
    if (!period) throw new NotFoundException("No existe un periodo activo");
    return {
      id: period.id,
      nombre: period.nombre,
      gestion: period.gestion,
      fechaInicio: period.fechaInicio.toISOString().slice(0, 10),
      fechaFin: period.fechaFin.toISOString().slice(0, 10),
      estado: period.estado,
    };
  }
}
