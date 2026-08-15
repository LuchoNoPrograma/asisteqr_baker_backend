ALTER TABLE "horarios_clase"
  ADD COLUMN "asignacion_id" UUID;

UPDATE "horarios_clase" horario
SET "asignacion_id" = asignacion."id"
FROM "configuraciones_horario" configuracion,
     "asignaciones_academicas" asignacion
WHERE configuracion."id" = horario."configuracion_id"
  AND asignacion."periodo_id" = configuracion."periodo_id"
  AND asignacion."curso_id" = horario."curso_id"
  AND asignacion."materia_id" = horario."materia_id"
  AND asignacion."docente_id" = horario."docente_id";

ALTER TABLE "horarios_clase"
  ADD CONSTRAINT "horarios_clase_asignacion_activa_check"
  CHECK (NOT "activo" OR "asignacion_id" IS NOT NULL);

CREATE INDEX "horarios_clase_asignacion_id_activo_idx"
  ON "horarios_clase"("asignacion_id", "activo");

ALTER TABLE "horarios_clase"
  ADD CONSTRAINT "horarios_clase_asignacion_id_fkey"
  FOREIGN KEY ("asignacion_id") REFERENCES "asignaciones_academicas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
