ALTER TABLE "asignaciones_academicas"
  ALTER COLUMN "periodo_id" SET NOT NULL,
  ALTER COLUMN "curso_id" SET NOT NULL,
  ALTER COLUMN "materia_id" SET NOT NULL,
  ALTER COLUMN "docente_id" SET NOT NULL;

ALTER TABLE "asistencias"
  ALTER COLUMN "estudiante_id" SET NOT NULL,
  ALTER COLUMN "curso_id" SET NOT NULL,
  ALTER COLUMN "horario_id" SET NOT NULL,
  ALTER COLUMN "registrado_por_id" SET NOT NULL;

ALTER TABLE "configuraciones_horario"
  ALTER COLUMN "periodo_id" SET NOT NULL;

ALTER TABLE "credenciales_qr"
  ALTER COLUMN "estudiante_id" SET NOT NULL;

ALTER TABLE "dias_no_lectivos"
  ALTER COLUMN "periodo_id" SET NOT NULL;

ALTER TABLE "horarios_clase"
  ALTER COLUMN "docente_id" SET NOT NULL,
  ALTER COLUMN "curso_id" SET NOT NULL;

ALTER TABLE "horarios_ingreso"
  ALTER COLUMN "curso_id" SET NOT NULL;

ALTER TABLE "inscripciones"
  ALTER COLUMN "estudiante_id" SET NOT NULL,
  ALTER COLUMN "curso_id" SET NOT NULL,
  ALTER COLUMN "periodo_id" SET NOT NULL;

ALTER TABLE "recreos_horario"
  ALTER COLUMN "configuracion_id" SET NOT NULL;

ALTER TABLE "sesiones"
  ALTER COLUMN "usuario_id" SET NOT NULL;
