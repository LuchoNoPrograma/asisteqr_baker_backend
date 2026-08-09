CREATE TYPE "EstadoDocente" AS ENUM ('ACTIVO', 'INACTIVO');

DROP INDEX "estudiantes_codigo_key";

ALTER TABLE "estudiantes"
  DROP COLUMN "codigo",
  ADD COLUMN "codigo_estudiante" SERIAL NOT NULL,
  ADD COLUMN "numero_documento" VARCHAR(30),
  ADD COLUMN "fecha_nacimiento" DATE,
  ADD COLUMN "telefono_tutor" VARCHAR(30);

CREATE UNIQUE INDEX "estudiantes_codigo_estudiante_key"
  ON "estudiantes"("codigo_estudiante");
CREATE UNIQUE INDEX "estudiantes_numero_documento_key"
  ON "estudiantes"("numero_documento");

CREATE TABLE "docentes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "numero_documento" VARCHAR(30),
  "nombres" VARCHAR(100) NOT NULL,
  "apellidos" VARCHAR(120) NOT NULL,
  "correo" VARCHAR(180),
  "telefono" VARCHAR(30),
  "estado" "EstadoDocente" NOT NULL DEFAULT 'ACTIVO',
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
  "creado_por" UUID,
  "actualizado_por" UUID,
  CONSTRAINT "docentes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "docentes_cursos" (
  "docente_id" UUID NOT NULL,
  "curso_id" UUID NOT NULL,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "docentes_cursos_pkey" PRIMARY KEY ("docente_id", "curso_id")
);

CREATE UNIQUE INDEX "docentes_numero_documento_key"
  ON "docentes"("numero_documento");
CREATE UNIQUE INDEX "docentes_correo_key" ON "docentes"("correo");
CREATE INDEX "docentes_apellidos_nombres_idx"
  ON "docentes"("apellidos", "nombres");
CREATE INDEX "docentes_estado_idx" ON "docentes"("estado");
CREATE INDEX "docentes_cursos_curso_id_idx"
  ON "docentes_cursos"("curso_id");

ALTER TABLE "docentes_cursos"
  ADD CONSTRAINT "docentes_cursos_docente_id_fkey"
  FOREIGN KEY ("docente_id") REFERENCES "docentes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "docentes_cursos"
  ADD CONSTRAINT "docentes_cursos_curso_id_fkey"
  FOREIGN KEY ("curso_id") REFERENCES "cursos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
