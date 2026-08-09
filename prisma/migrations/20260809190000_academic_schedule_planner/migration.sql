CREATE TABLE "asignaciones_academicas" (
  "id" UUID NOT NULL,
  "periodo_id" UUID NOT NULL,
  "curso_id" UUID NOT NULL,
  "materia_id" UUID NOT NULL,
  "docente_id" UUID NOT NULL,
  "minutos_semanales" INTEGER NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "asignaciones_academicas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asignaciones_academicas_minutos_check"
    CHECK ("minutos_semanales" BETWEEN 30 AND 2400 AND "minutos_semanales" % 30 = 0)
);

CREATE UNIQUE INDEX "asignaciones_academicas_periodo_id_curso_id_materia_id_key"
  ON "asignaciones_academicas"("periodo_id", "curso_id", "materia_id");
CREATE INDEX "asignaciones_academicas_docente_id_activo_idx"
  ON "asignaciones_academicas"("docente_id", "activo");
CREATE INDEX "asignaciones_academicas_curso_id_activo_idx"
  ON "asignaciones_academicas"("curso_id", "activo");

ALTER TABLE "asignaciones_academicas"
  ADD CONSTRAINT "asignaciones_academicas_periodo_id_fkey"
  FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asignaciones_academicas"
  ADD CONSTRAINT "asignaciones_academicas_curso_id_fkey"
  FOREIGN KEY ("curso_id") REFERENCES "cursos"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asignaciones_academicas"
  ADD CONSTRAINT "asignaciones_academicas_materia_id_fkey"
  FOREIGN KEY ("materia_id") REFERENCES "materias"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asignaciones_academicas"
  ADD CONSTRAINT "asignaciones_academicas_docente_id_fkey"
  FOREIGN KEY ("docente_id") REFERENCES "docentes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "asignaciones_academicas" (
  "id",
  "periodo_id",
  "curso_id",
  "materia_id",
  "docente_id",
  "minutos_semanales",
  "actualizado_en"
)
SELECT
  gen_random_uuid(),
  configuracion."periodo_id",
  horario."curso_id",
  horario."materia_id",
  horario."docente_id",
  GREATEST(
    30,
    SUM(EXTRACT(EPOCH FROM (horario."hora_fin" - horario."hora_inicio")) / 60)::INTEGER
  ),
  CURRENT_TIMESTAMP
FROM "horarios_clase" horario
INNER JOIN "configuraciones_horario" configuracion
  ON configuracion."id" = horario."configuracion_id"
WHERE horario."activo" = true AND horario."materia_id" IS NOT NULL
GROUP BY
  configuracion."periodo_id",
  horario."curso_id",
  horario."materia_id",
  horario."docente_id"
ON CONFLICT ("periodo_id", "curso_id", "materia_id") DO NOTHING;
