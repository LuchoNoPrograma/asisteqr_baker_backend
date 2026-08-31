-- Preserve the effective interval of each enrollment instead of overwriting
-- the course attached to the current row.
ALTER TABLE "inscripciones"
ADD COLUMN "vigente_desde" DATE,
ADD COLUMN "vigente_hasta" DATE;

UPDATE "inscripciones" AS i
SET
  "vigente_desde" = p."fecha_inicio",
  "vigente_hasta" = CASE
    WHEN i."estado" = 'RETIRADA' THEN LEAST(
      p."fecha_fin" + 1,
      GREATEST(p."fecha_inicio", i."creado_en"::date)
    )
    ELSE NULL
  END
FROM "periodos_academicos" AS p
WHERE p."id" = i."periodo_id";

ALTER TABLE "inscripciones"
ALTER COLUMN "vigente_desde" SET NOT NULL;

DROP INDEX "inscripciones_estudiante_id_periodo_id_key";

CREATE UNIQUE INDEX "inscripciones_estudiante_id_periodo_id_vigente_desde_key"
ON "inscripciones"("estudiante_id", "periodo_id", "vigente_desde");

CREATE UNIQUE INDEX "inscripciones_estudiante_periodo_vigente_key"
ON "inscripciones"("estudiante_id", "periodo_id")
WHERE "vigente_hasta" IS NULL;

CREATE INDEX "inscripciones_curso_id_periodo_id_vigencia_idx"
ON "inscripciones"("curso_id", "periodo_id", "vigente_desde", "vigente_hasta");

CREATE INDEX "inscripciones_estudiante_id_periodo_id_vigencia_idx"
ON "inscripciones"("estudiante_id", "periodo_id", "vigente_desde", "vigente_hasta");

ALTER TABLE "inscripciones"
ADD CONSTRAINT "inscripciones_intervalo_valido_check"
CHECK ("vigente_hasta" IS NULL OR "vigente_desde" <= "vigente_hasta"),
ADD CONSTRAINT "inscripciones_estado_vigencia_check"
CHECK (
  ("estado" = 'ACTIVA' AND "vigente_hasta" IS NULL)
  OR ("estado" = 'RETIRADA' AND "vigente_hasta" IS NOT NULL)
);

-- A course can change its admission time without rewriting the schedule used
-- by attendance records from previous dates.
ALTER TABLE "horarios_ingreso"
ADD COLUMN "vigente_desde" DATE,
ADD COLUMN "vigente_hasta" DATE;

UPDATE "horarios_ingreso" AS h
SET "vigente_desde" = COALESCE(
  (
    SELECT MIN(p."fecha_inicio")
    FROM "cursos" AS c
    JOIN "periodos_academicos" AS p ON p."gestion" = c."gestion"
    WHERE c."id" = h."curso_id"
  ),
  h."creado_en"::date
);

UPDATE "horarios_ingreso"
SET "vigente_hasta" = GREATEST("vigente_desde", "actualizado_en"::date)
WHERE "activo" = false;

ALTER TABLE "horarios_ingreso"
ALTER COLUMN "vigente_desde" SET NOT NULL;

DROP INDEX "horarios_ingreso_curso_id_jornada_key";

CREATE UNIQUE INDEX "horarios_ingreso_curso_id_jornada_vigente_desde_key"
ON "horarios_ingreso"("curso_id", "jornada", "vigente_desde");

CREATE UNIQUE INDEX "horarios_ingreso_curso_jornada_vigente_key"
ON "horarios_ingreso"("curso_id", "jornada")
WHERE "vigente_hasta" IS NULL;

CREATE INDEX "horarios_ingreso_curso_id_vigencia_idx"
ON "horarios_ingreso"("curso_id", "vigente_desde", "vigente_hasta");

ALTER TABLE "horarios_ingreso"
ADD CONSTRAINT "horarios_ingreso_intervalo_valido_check"
CHECK ("vigente_hasta" IS NULL OR "vigente_desde" <= "vigente_hasta"),
ADD CONSTRAINT "horarios_ingreso_activo_vigencia_check"
CHECK (
  ("activo" = true AND "vigente_hasta" IS NULL)
  OR ("activo" = false AND "vigente_hasta" IS NOT NULL)
);

-- Explicit academic calendar exceptions used by historical reports.
CREATE TABLE "dias_no_lectivos" (
  "id" UUID NOT NULL,
  "periodo_id" UUID NOT NULL,
  "fecha" DATE NOT NULL,
  "descripcion" VARCHAR(180) NOT NULL,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dias_no_lectivos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dias_no_lectivos_periodo_id_fecha_key"
ON "dias_no_lectivos"("periodo_id", "fecha");

CREATE INDEX "dias_no_lectivos_fecha_idx"
ON "dias_no_lectivos"("fecha");

ALTER TABLE "dias_no_lectivos"
ADD CONSTRAINT "dias_no_lectivos_periodo_id_fkey"
FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
