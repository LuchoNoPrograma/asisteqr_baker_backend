CREATE SEQUENCE "docentes_codigo_docente_seq";

ALTER TABLE "estudiantes"
  ADD COLUMN "nombre_tutor" VARCHAR(180),
  ALTER COLUMN "fotografia_url" TYPE TEXT;

ALTER TABLE "docentes"
  ADD COLUMN "codigo_docente" INTEGER,
  ADD COLUMN "especialidad" VARCHAR(120),
  ADD COLUMN "fotografia_url" TEXT;

ALTER SEQUENCE "docentes_codigo_docente_seq"
  OWNED BY "docentes"."codigo_docente";

ALTER TABLE "docentes"
  ALTER COLUMN "codigo_docente"
  SET DEFAULT nextval('"docentes_codigo_docente_seq"');

UPDATE "docentes"
SET
  "codigo_docente" = nextval('"docentes_codigo_docente_seq"'),
  "especialidad" = 'Docencia general'
WHERE "codigo_docente" IS NULL OR "especialidad" IS NULL;

ALTER TABLE "docentes"
  ALTER COLUMN "codigo_docente" SET NOT NULL,
  ALTER COLUMN "especialidad" SET NOT NULL;

CREATE UNIQUE INDEX "docentes_codigo_docente_key"
  ON "docentes"("codigo_docente");
