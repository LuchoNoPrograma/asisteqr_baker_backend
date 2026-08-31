import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Roles } from "../../../comun/seguridad/roles.decorator";
import { RolesGuard } from "../../../comun/seguridad/roles.guard";
import {
  optionalPositiveIntegerIdPipe,
  positiveIntegerIdPipe,
} from "../../../comun/validacion/integer-id-pipes";
import { SessionAuthGuard } from "../../autenticacion/infraestructura/session-auth.guard";
import { ReportsService } from "./reports.service";

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller("reportes")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("resumen")
  summary(
    @Query("desde") desde: string,
    @Query("hasta") hasta: string,
    @Query("cursoId", optionalPositiveIntegerIdPipe) cursoId?: number,
  ) {
    return this.service.summary(desde, hasta, cursoId);
  }

  @Get("exportar/pdf")
  async exportPdf(
    @Query("desde") desde: string,
    @Query("hasta") hasta: string,
    @Query("cursoId", optionalPositiveIntegerIdPipe)
    cursoId: number | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.service.exportPdf(desde, hasta, cursoId);
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="asisteqr-${desde}-${hasta}.pdf"`,
      "Content-Length": pdf.length.toString(),
      "Cache-Control": "private, no-store",
    });
    return new StreamableFile(pdf);
  }
}

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMINISTRADOR", "DOCENTE")
@Controller("estudiantes")
export class StudentsController {
  constructor(private readonly service: ReportsService) {}

  @Get(":id/historial")
  history(
    @Param("id", positiveIntegerIdPipe) id: number,
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string,
  ) {
    return this.service.studentHistory(id, desde, hasta);
  }
}
