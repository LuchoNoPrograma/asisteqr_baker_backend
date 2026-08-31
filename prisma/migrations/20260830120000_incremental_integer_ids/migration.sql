-- Migra todas las claves internas UUID a enteros autoincrementales sin borrar filas.
-- Las tablas temporales conservan la correspondencia UUID -> INTEGER durante la transacción.
BEGIN;

LOCK TABLE
  "usuarios", "roles", "usuarios_roles", "periodos_academicos",
  "dias_no_lectivos", "cursos", "configuraciones_horario",
  "recreos_horario", "materias", "aulas", "estudiantes", "docentes",
  "asignaciones_academicas", "celdas_horario_curso_legacy",
  "docentes_cursos_legacy", "horarios_clase", "inscripciones",
  "horarios_ingreso", "credenciales_qr", "asistencias", "sesiones",
  "auditoria"
IN ACCESS EXCLUSIVE MODE;

-- Nuevas PK secuenciales. SERIAL rellena también las filas existentes.
ALTER TABLE "usuarios" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "roles" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "periodos_academicos" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "dias_no_lectivos" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "cursos" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "configuraciones_horario" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "recreos_horario" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "materias" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "aulas" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "estudiantes" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "docentes" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "asignaciones_academicas" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "horarios_clase" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "inscripciones" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "horarios_ingreso" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "credenciales_qr" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "asistencias" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "sesiones" ADD COLUMN "id_new" SERIAL NOT NULL;
ALTER TABLE "auditoria" ADD COLUMN "id_new" SERIAL NOT NULL;

CREATE TEMP TABLE "map_usuarios" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "usuarios";
CREATE TEMP TABLE "map_roles" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "roles";
CREATE TEMP TABLE "map_periodos" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "periodos_academicos";
CREATE TEMP TABLE "map_dias_no_lectivos" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "dias_no_lectivos";
CREATE TEMP TABLE "map_cursos" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "cursos";
CREATE TEMP TABLE "map_configuraciones" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "configuraciones_horario";
CREATE TEMP TABLE "map_recreos" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "recreos_horario";
CREATE TEMP TABLE "map_materias" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "materias";
CREATE TEMP TABLE "map_aulas" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "aulas";
CREATE TEMP TABLE "map_estudiantes" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "estudiantes";
CREATE TEMP TABLE "map_docentes" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "docentes";
CREATE TEMP TABLE "map_asignaciones" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "asignaciones_academicas";
CREATE TEMP TABLE "map_horarios_clase" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "horarios_clase";
CREATE TEMP TABLE "map_inscripciones" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "inscripciones";
CREATE TEMP TABLE "map_horarios_ingreso" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "horarios_ingreso";
CREATE TEMP TABLE "map_credenciales" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "credenciales_qr";
CREATE TEMP TABLE "map_asistencias" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "asistencias";
CREATE TEMP TABLE "map_sesiones" ON COMMIT DROP AS
  SELECT "id" AS "old_id", "id_new" AS "new_id" FROM "sesiones";

-- Nuevas FK enteras.
ALTER TABLE "usuarios"
  ADD COLUMN "creado_por_new" INTEGER,
  ADD COLUMN "actualizado_por_new" INTEGER;
ALTER TABLE "usuarios_roles"
  ADD COLUMN "usuario_id_new" INTEGER,
  ADD COLUMN "rol_id_new" INTEGER;
ALTER TABLE "dias_no_lectivos" ADD COLUMN "periodo_id_new" INTEGER;
ALTER TABLE "configuraciones_horario" ADD COLUMN "periodo_id_new" INTEGER;
ALTER TABLE "recreos_horario" ADD COLUMN "configuracion_id_new" INTEGER;
ALTER TABLE "celdas_horario_curso_legacy" ADD COLUMN "curso_id_new" INTEGER;
ALTER TABLE "docentes"
  ADD COLUMN "creado_por_new" INTEGER,
  ADD COLUMN "actualizado_por_new" INTEGER;
ALTER TABLE "asignaciones_academicas"
  ADD COLUMN "periodo_id_new" INTEGER,
  ADD COLUMN "curso_id_new" INTEGER,
  ADD COLUMN "materia_id_new" INTEGER,
  ADD COLUMN "docente_id_new" INTEGER;
ALTER TABLE "docentes_cursos_legacy"
  ADD COLUMN "docente_id_new" INTEGER,
  ADD COLUMN "curso_id_new" INTEGER;
ALTER TABLE "horarios_clase"
  ADD COLUMN "configuracion_id_new" INTEGER,
  ADD COLUMN "asignacion_id_new" INTEGER,
  ADD COLUMN "docente_id_new" INTEGER,
  ADD COLUMN "curso_id_new" INTEGER,
  ADD COLUMN "materia_id_new" INTEGER,
  ADD COLUMN "aula_id_new" INTEGER,
  ADD COLUMN "creado_por_new" INTEGER;
ALTER TABLE "inscripciones"
  ADD COLUMN "estudiante_id_new" INTEGER,
  ADD COLUMN "curso_id_new" INTEGER,
  ADD COLUMN "periodo_id_new" INTEGER;
ALTER TABLE "horarios_ingreso" ADD COLUMN "curso_id_new" INTEGER;
ALTER TABLE "credenciales_qr" ADD COLUMN "estudiante_id_new" INTEGER;
ALTER TABLE "asistencias"
  ADD COLUMN "estudiante_id_new" INTEGER,
  ADD COLUMN "curso_id_new" INTEGER,
  ADD COLUMN "horario_id_new" INTEGER,
  ADD COLUMN "registrado_por_id_new" INTEGER;
ALTER TABLE "sesiones" ADD COLUMN "usuario_id_new" INTEGER;
ALTER TABLE "auditoria"
  ADD COLUMN "usuario_id_new" INTEGER,
  ADD COLUMN "recurso_id_new" INTEGER;

UPDATE "usuarios" value
SET "creado_por_new" = creator."new_id"
FROM "map_usuarios" creator
WHERE value."creado_por" = creator."old_id";
UPDATE "usuarios" value
SET "actualizado_por_new" = updater."new_id"
FROM "map_usuarios" updater
WHERE value."actualizado_por" = updater."old_id";
UPDATE "usuarios_roles" value
SET "usuario_id_new" = users."new_id", "rol_id_new" = roles."new_id"
FROM "map_usuarios" users, "map_roles" roles
WHERE value."usuario_id" = users."old_id" AND value."rol_id" = roles."old_id";
UPDATE "dias_no_lectivos" value SET "periodo_id_new" = map."new_id"
FROM "map_periodos" map WHERE value."periodo_id" = map."old_id";
UPDATE "configuraciones_horario" value SET "periodo_id_new" = map."new_id"
FROM "map_periodos" map WHERE value."periodo_id" = map."old_id";
UPDATE "recreos_horario" value SET "configuracion_id_new" = map."new_id"
FROM "map_configuraciones" map WHERE value."configuracion_id" = map."old_id";
UPDATE "celdas_horario_curso_legacy" value SET "curso_id_new" = map."new_id"
FROM "map_cursos" map WHERE value."curso_id" = map."old_id";
UPDATE "docentes" value SET "creado_por_new" = map."new_id"
FROM "map_usuarios" map WHERE value."creado_por" = map."old_id";
UPDATE "docentes" value SET "actualizado_por_new" = map."new_id"
FROM "map_usuarios" map WHERE value."actualizado_por" = map."old_id";
UPDATE "asignaciones_academicas" value
SET "periodo_id_new" = periods."new_id",
    "curso_id_new" = courses."new_id",
    "materia_id_new" = subjects."new_id",
    "docente_id_new" = teachers."new_id"
FROM "map_periodos" periods, "map_cursos" courses,
     "map_materias" subjects, "map_docentes" teachers
WHERE value."periodo_id" = periods."old_id"
  AND value."curso_id" = courses."old_id"
  AND value."materia_id" = subjects."old_id"
  AND value."docente_id" = teachers."old_id";
UPDATE "docentes_cursos_legacy" value
SET "docente_id_new" = teachers."new_id", "curso_id_new" = courses."new_id"
FROM "map_docentes" teachers, "map_cursos" courses
WHERE value."docente_id" = teachers."old_id" AND value."curso_id" = courses."old_id";
UPDATE "horarios_clase" value SET "configuracion_id_new" = map."new_id"
FROM "map_configuraciones" map WHERE value."configuracion_id" = map."old_id";
UPDATE "horarios_clase" value SET "asignacion_id_new" = map."new_id"
FROM "map_asignaciones" map WHERE value."asignacion_id" = map."old_id";
UPDATE "horarios_clase" value SET "docente_id_new" = map."new_id"
FROM "map_docentes" map WHERE value."docente_id" = map."old_id";
UPDATE "horarios_clase" value SET "curso_id_new" = map."new_id"
FROM "map_cursos" map WHERE value."curso_id" = map."old_id";
UPDATE "horarios_clase" value SET "materia_id_new" = map."new_id"
FROM "map_materias" map WHERE value."materia_id" = map."old_id";
UPDATE "horarios_clase" value SET "aula_id_new" = map."new_id"
FROM "map_aulas" map WHERE value."aula_id" = map."old_id";
UPDATE "horarios_clase" value SET "creado_por_new" = map."new_id"
FROM "map_usuarios" map WHERE value."creado_por" = map."old_id";
UPDATE "inscripciones" value
SET "estudiante_id_new" = students."new_id",
    "curso_id_new" = courses."new_id",
    "periodo_id_new" = periods."new_id"
FROM "map_estudiantes" students, "map_cursos" courses, "map_periodos" periods
WHERE value."estudiante_id" = students."old_id"
  AND value."curso_id" = courses."old_id"
  AND value."periodo_id" = periods."old_id";
UPDATE "horarios_ingreso" value SET "curso_id_new" = map."new_id"
FROM "map_cursos" map WHERE value."curso_id" = map."old_id";
UPDATE "credenciales_qr" value SET "estudiante_id_new" = map."new_id"
FROM "map_estudiantes" map WHERE value."estudiante_id" = map."old_id";
UPDATE "asistencias" value
SET "estudiante_id_new" = students."new_id",
    "curso_id_new" = courses."new_id",
    "horario_id_new" = schedules."new_id",
    "registrado_por_id_new" = users."new_id"
FROM "map_estudiantes" students, "map_cursos" courses,
     "map_horarios_ingreso" schedules, "map_usuarios" users
WHERE value."estudiante_id" = students."old_id"
  AND value."curso_id" = courses."old_id"
  AND value."horario_id" = schedules."old_id"
  AND value."registrado_por_id" = users."old_id";
UPDATE "sesiones" value SET "usuario_id_new" = map."new_id"
FROM "map_usuarios" map WHERE value."usuario_id" = map."old_id";
UPDATE "auditoria" value SET "usuario_id_new" = map."new_id"
FROM "map_usuarios" map WHERE value."usuario_id" = map."old_id";

-- Conserva el identificador histórico en metadatos; recurso_id pasa a INTEGER
-- cuando la fila referenciada todavía existe.
UPDATE "auditoria"
SET "metadatos" = COALESCE("metadatos", '{}'::jsonb)
  || jsonb_build_object('recursoIdUuidAnterior', "recurso_id")
WHERE "recurso_id" IS NOT NULL;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_asistencias" map
WHERE value."recurso" = 'asistencias' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_aulas" map
WHERE value."recurso" = 'aulas' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_cursos" map
WHERE value."recurso" = 'cursos' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_docentes" map
WHERE value."recurso" = 'docentes' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_estudiantes" map
WHERE value."recurso" = 'estudiantes' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_horarios_clase" map
WHERE value."recurso" = 'horarios_clase' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_horarios_ingreso" map
WHERE value."recurso" = 'horarios_ingreso' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_materias" map
WHERE value."recurso" = 'materias' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_configuraciones" map
WHERE value."recurso" = 'configuraciones_horario' AND value."recurso_id" = map."old_id"::text;
UPDATE "auditoria" value SET "recurso_id_new" = map."new_id"
FROM "map_dias_no_lectivos" map
WHERE value."recurso" = 'dias_no_lectivos' AND value."recurso_id" = map."old_id"::text;

-- Los QR impresos con UUID siguen resolviéndose por token_hash después del cambio.
UPDATE "credenciales_qr"
SET "token_hash" = COALESCE(
  "token_hash",
  encode(sha256(convert_to('AQB1.v1_' || "id"::text, 'UTF8')), 'hex')
);

-- Aborta sin modificar nada si una relación obligatoria no pudo mapearse.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "usuarios_roles" WHERE "usuario_id_new" IS NULL OR "rol_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "dias_no_lectivos" WHERE "periodo_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "configuraciones_horario" WHERE "periodo_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "recreos_horario" WHERE "configuracion_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "celdas_horario_curso_legacy" WHERE "curso_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "asignaciones_academicas" WHERE "periodo_id_new" IS NULL OR "curso_id_new" IS NULL OR "materia_id_new" IS NULL OR "docente_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "docentes_cursos_legacy" WHERE "docente_id_new" IS NULL OR "curso_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "horarios_clase" WHERE "docente_id_new" IS NULL OR "curso_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "horarios_clase" WHERE "configuracion_id" IS NOT NULL AND "configuracion_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "horarios_clase" WHERE "asignacion_id" IS NOT NULL AND "asignacion_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "horarios_clase" WHERE "materia_id" IS NOT NULL AND "materia_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "horarios_clase" WHERE "aula_id" IS NOT NULL AND "aula_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "inscripciones" WHERE "estudiante_id_new" IS NULL OR "curso_id_new" IS NULL OR "periodo_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "horarios_ingreso" WHERE "curso_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "credenciales_qr" WHERE "estudiante_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "asistencias" WHERE "estudiante_id_new" IS NULL OR "curso_id_new" IS NULL OR "horario_id_new" IS NULL OR "registrado_por_id_new" IS NULL)
    OR EXISTS (SELECT 1 FROM "sesiones" WHERE "usuario_id_new" IS NULL)
  THEN
    RAISE EXCEPTION 'No se pudieron mapear todas las relaciones UUID a INTEGER';
  END IF;
END $$;

-- Sustituye FK y campos de auditoría por sus equivalentes INTEGER.
ALTER TABLE "usuarios"
  DROP COLUMN "creado_por", DROP COLUMN "actualizado_por";
ALTER TABLE "usuarios" RENAME COLUMN "creado_por_new" TO "creado_por";
ALTER TABLE "usuarios" RENAME COLUMN "actualizado_por_new" TO "actualizado_por";
ALTER TABLE "usuarios_roles"
  DROP COLUMN "usuario_id", DROP COLUMN "rol_id";
ALTER TABLE "usuarios_roles" RENAME COLUMN "usuario_id_new" TO "usuario_id";
ALTER TABLE "usuarios_roles" RENAME COLUMN "rol_id_new" TO "rol_id";
ALTER TABLE "dias_no_lectivos" DROP COLUMN "periodo_id";
ALTER TABLE "dias_no_lectivos" RENAME COLUMN "periodo_id_new" TO "periodo_id";
ALTER TABLE "configuraciones_horario" DROP COLUMN "periodo_id";
ALTER TABLE "configuraciones_horario" RENAME COLUMN "periodo_id_new" TO "periodo_id";
ALTER TABLE "recreos_horario" DROP COLUMN "configuracion_id";
ALTER TABLE "recreos_horario" RENAME COLUMN "configuracion_id_new" TO "configuracion_id";
ALTER TABLE "celdas_horario_curso_legacy" DROP COLUMN "curso_id";
ALTER TABLE "celdas_horario_curso_legacy" RENAME COLUMN "curso_id_new" TO "curso_id";
ALTER TABLE "docentes"
  DROP COLUMN "creado_por", DROP COLUMN "actualizado_por";
ALTER TABLE "docentes" RENAME COLUMN "creado_por_new" TO "creado_por";
ALTER TABLE "docentes" RENAME COLUMN "actualizado_por_new" TO "actualizado_por";
ALTER TABLE "asignaciones_academicas"
  DROP COLUMN "periodo_id", DROP COLUMN "curso_id",
  DROP COLUMN "materia_id", DROP COLUMN "docente_id";
ALTER TABLE "asignaciones_academicas" RENAME COLUMN "periodo_id_new" TO "periodo_id";
ALTER TABLE "asignaciones_academicas" RENAME COLUMN "curso_id_new" TO "curso_id";
ALTER TABLE "asignaciones_academicas" RENAME COLUMN "materia_id_new" TO "materia_id";
ALTER TABLE "asignaciones_academicas" RENAME COLUMN "docente_id_new" TO "docente_id";
ALTER TABLE "docentes_cursos_legacy"
  DROP COLUMN "docente_id", DROP COLUMN "curso_id";
ALTER TABLE "docentes_cursos_legacy" RENAME COLUMN "docente_id_new" TO "docente_id";
ALTER TABLE "docentes_cursos_legacy" RENAME COLUMN "curso_id_new" TO "curso_id";
ALTER TABLE "horarios_clase"
  DROP COLUMN "configuracion_id", DROP COLUMN "asignacion_id",
  DROP COLUMN "docente_id", DROP COLUMN "curso_id", DROP COLUMN "materia_id",
  DROP COLUMN "aula_id", DROP COLUMN "creado_por";
ALTER TABLE "horarios_clase" RENAME COLUMN "configuracion_id_new" TO "configuracion_id";
ALTER TABLE "horarios_clase" RENAME COLUMN "asignacion_id_new" TO "asignacion_id";
ALTER TABLE "horarios_clase" RENAME COLUMN "docente_id_new" TO "docente_id";
ALTER TABLE "horarios_clase" RENAME COLUMN "curso_id_new" TO "curso_id";
ALTER TABLE "horarios_clase" RENAME COLUMN "materia_id_new" TO "materia_id";
ALTER TABLE "horarios_clase" RENAME COLUMN "aula_id_new" TO "aula_id";
ALTER TABLE "horarios_clase" RENAME COLUMN "creado_por_new" TO "creado_por";
ALTER TABLE "inscripciones"
  DROP COLUMN "estudiante_id", DROP COLUMN "curso_id", DROP COLUMN "periodo_id";
ALTER TABLE "inscripciones" RENAME COLUMN "estudiante_id_new" TO "estudiante_id";
ALTER TABLE "inscripciones" RENAME COLUMN "curso_id_new" TO "curso_id";
ALTER TABLE "inscripciones" RENAME COLUMN "periodo_id_new" TO "periodo_id";
ALTER TABLE "horarios_ingreso" DROP COLUMN "curso_id";
ALTER TABLE "horarios_ingreso" RENAME COLUMN "curso_id_new" TO "curso_id";
ALTER TABLE "credenciales_qr" DROP COLUMN "estudiante_id";
ALTER TABLE "credenciales_qr" RENAME COLUMN "estudiante_id_new" TO "estudiante_id";
ALTER TABLE "asistencias"
  DROP COLUMN "estudiante_id", DROP COLUMN "curso_id",
  DROP COLUMN "horario_id", DROP COLUMN "registrado_por_id";
ALTER TABLE "asistencias" RENAME COLUMN "estudiante_id_new" TO "estudiante_id";
ALTER TABLE "asistencias" RENAME COLUMN "curso_id_new" TO "curso_id";
ALTER TABLE "asistencias" RENAME COLUMN "horario_id_new" TO "horario_id";
ALTER TABLE "asistencias" RENAME COLUMN "registrado_por_id_new" TO "registrado_por_id";
ALTER TABLE "sesiones" DROP COLUMN "usuario_id";
ALTER TABLE "sesiones" RENAME COLUMN "usuario_id_new" TO "usuario_id";
ALTER TABLE "auditoria" DROP COLUMN "usuario_id", DROP COLUMN "recurso_id";
ALTER TABLE "auditoria" RENAME COLUMN "usuario_id_new" TO "usuario_id";
ALTER TABLE "auditoria" RENAME COLUMN "recurso_id_new" TO "recurso_id";

-- Sustituye las PK UUID y conserva la secuencia generada para cada tabla.
ALTER TABLE "usuarios" DROP COLUMN "id" CASCADE;
ALTER TABLE "usuarios" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "roles" DROP COLUMN "id" CASCADE;
ALTER TABLE "roles" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "periodos_academicos" DROP COLUMN "id" CASCADE;
ALTER TABLE "periodos_academicos" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "dias_no_lectivos" DROP COLUMN "id" CASCADE;
ALTER TABLE "dias_no_lectivos" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "cursos" DROP COLUMN "id" CASCADE;
ALTER TABLE "cursos" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "configuraciones_horario" DROP COLUMN "id" CASCADE;
ALTER TABLE "configuraciones_horario" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "recreos_horario" DROP COLUMN "id" CASCADE;
ALTER TABLE "recreos_horario" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "materias" DROP COLUMN "id" CASCADE;
ALTER TABLE "materias" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "aulas" DROP COLUMN "id" CASCADE;
ALTER TABLE "aulas" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "estudiantes" DROP COLUMN "id" CASCADE;
ALTER TABLE "estudiantes" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "docentes" DROP COLUMN "id" CASCADE;
ALTER TABLE "docentes" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "asignaciones_academicas" DROP COLUMN "id" CASCADE;
ALTER TABLE "asignaciones_academicas" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "horarios_clase" DROP COLUMN "id" CASCADE;
ALTER TABLE "horarios_clase" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "inscripciones" DROP COLUMN "id" CASCADE;
ALTER TABLE "inscripciones" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "horarios_ingreso" DROP COLUMN "id" CASCADE;
ALTER TABLE "horarios_ingreso" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "credenciales_qr" DROP COLUMN "id" CASCADE;
ALTER TABLE "credenciales_qr" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "asistencias" DROP COLUMN "id" CASCADE;
ALTER TABLE "asistencias" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "sesiones" DROP COLUMN "id" CASCADE;
ALTER TABLE "sesiones" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "auditoria" DROP COLUMN "id" CASCADE;
ALTER TABLE "auditoria" RENAME COLUMN "id_new" TO "id";

ALTER SEQUENCE "usuarios_id_new_seq" RENAME TO "usuarios_id_seq";
ALTER SEQUENCE "roles_id_new_seq" RENAME TO "roles_id_seq";
ALTER SEQUENCE "periodos_academicos_id_new_seq" RENAME TO "periodos_academicos_id_seq";
ALTER SEQUENCE "dias_no_lectivos_id_new_seq" RENAME TO "dias_no_lectivos_id_seq";
ALTER SEQUENCE "cursos_id_new_seq" RENAME TO "cursos_id_seq";
ALTER SEQUENCE "configuraciones_horario_id_new_seq" RENAME TO "configuraciones_horario_id_seq";
ALTER SEQUENCE "recreos_horario_id_new_seq" RENAME TO "recreos_horario_id_seq";
ALTER SEQUENCE "materias_id_new_seq" RENAME TO "materias_id_seq";
ALTER SEQUENCE "aulas_id_new_seq" RENAME TO "aulas_id_seq";
ALTER SEQUENCE "estudiantes_id_new_seq" RENAME TO "estudiantes_id_seq";
ALTER SEQUENCE "docentes_id_new_seq" RENAME TO "docentes_id_seq";
ALTER SEQUENCE "asignaciones_academicas_id_new_seq" RENAME TO "asignaciones_academicas_id_seq";
ALTER SEQUENCE "horarios_clase_id_new_seq" RENAME TO "horarios_clase_id_seq";
ALTER SEQUENCE "inscripciones_id_new_seq" RENAME TO "inscripciones_id_seq";
ALTER SEQUENCE "horarios_ingreso_id_new_seq" RENAME TO "horarios_ingreso_id_seq";
ALTER SEQUENCE "credenciales_qr_id_new_seq" RENAME TO "credenciales_qr_id_seq";
ALTER SEQUENCE "asistencias_id_new_seq" RENAME TO "asistencias_id_seq";
ALTER SEQUENCE "sesiones_id_new_seq" RENAME TO "sesiones_id_seq";
ALTER SEQUENCE "auditoria_id_new_seq" RENAME TO "auditoria_id_seq";

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id");
ALTER TABLE "roles" ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");
ALTER TABLE "periodos_academicos" ADD CONSTRAINT "periodos_academicos_pkey" PRIMARY KEY ("id");
ALTER TABLE "dias_no_lectivos" ADD CONSTRAINT "dias_no_lectivos_pkey" PRIMARY KEY ("id");
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_pkey" PRIMARY KEY ("id");
ALTER TABLE "configuraciones_horario" ADD CONSTRAINT "configuraciones_horario_pkey" PRIMARY KEY ("id");
ALTER TABLE "recreos_horario" ADD CONSTRAINT "recreos_horario_pkey" PRIMARY KEY ("id");
ALTER TABLE "materias" ADD CONSTRAINT "materias_pkey" PRIMARY KEY ("id");
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_pkey" PRIMARY KEY ("id");
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id");
ALTER TABLE "docentes" ADD CONSTRAINT "docentes_pkey" PRIMARY KEY ("id");
ALTER TABLE "asignaciones_academicas" ADD CONSTRAINT "asignaciones_academicas_pkey" PRIMARY KEY ("id");
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_pkey" PRIMARY KEY ("id");
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id");
ALTER TABLE "horarios_ingreso" ADD CONSTRAINT "horarios_ingreso_pkey" PRIMARY KEY ("id");
ALTER TABLE "credenciales_qr" ADD CONSTRAINT "credenciales_qr_pkey" PRIMARY KEY ("id");
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id");
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id");
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id");
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_pkey" PRIMARY KEY ("usuario_id", "rol_id");
ALTER TABLE "celdas_horario_curso_legacy" ADD CONSTRAINT "celdas_horario_curso_pkey" PRIMARY KEY ("curso_id", "dia_semana", "hora");
ALTER TABLE "docentes_cursos_legacy" ADD CONSTRAINT "docentes_cursos_pkey" PRIMARY KEY ("docente_id", "curso_id");

CREATE INDEX "usuarios_roles_rol_id_idx" ON "usuarios_roles"("rol_id");
CREATE UNIQUE INDEX "dias_no_lectivos_periodo_id_fecha_key" ON "dias_no_lectivos"("periodo_id", "fecha");
CREATE UNIQUE INDEX "configuraciones_horario_periodo_id_key" ON "configuraciones_horario"("periodo_id");
CREATE INDEX "recreos_horario_configuracion_id_activo_hora_inicio_idx" ON "recreos_horario"("configuracion_id", "activo", "hora_inicio");
CREATE INDEX "asignaciones_academicas_docente_id_activo_idx" ON "asignaciones_academicas"("docente_id", "activo");
CREATE INDEX "asignaciones_academicas_curso_id_activo_idx" ON "asignaciones_academicas"("curso_id", "activo");
CREATE UNIQUE INDEX "asignaciones_academicas_periodo_id_curso_id_materia_id_key" ON "asignaciones_academicas"("periodo_id", "curso_id", "materia_id");
CREATE INDEX "docentes_cursos_curso_id_idx" ON "docentes_cursos_legacy"("curso_id");
CREATE INDEX "horarios_clase_docente_id_dia_semana_hora_inicio_idx" ON "horarios_clase"("docente_id", "dia_semana", "hora_inicio");
CREATE INDEX "horarios_clase_curso_id_dia_semana_hora_inicio_idx" ON "horarios_clase"("curso_id", "dia_semana", "hora_inicio");
CREATE INDEX "horarios_clase_configuracion_id_activo_dia_semana_hora_inic_idx" ON "horarios_clase"("configuracion_id", "activo", "dia_semana", "hora_inicio");
CREATE INDEX "horarios_clase_asignacion_id_activo_idx" ON "horarios_clase"("asignacion_id", "activo");
CREATE INDEX "horarios_clase_aula_id_dia_semana_hora_inicio_idx" ON "horarios_clase"("aula_id", "dia_semana", "hora_inicio");
CREATE INDEX "inscripciones_curso_id_periodo_id_vigente_desde_vigente_has_idx" ON "inscripciones"("curso_id", "periodo_id", "vigente_desde", "vigente_hasta");
CREATE INDEX "inscripciones_estudiante_id_periodo_id_vigente_desde_vigent_idx" ON "inscripciones"("estudiante_id", "periodo_id", "vigente_desde", "vigente_hasta");
CREATE INDEX "inscripciones_curso_id_estado_idx" ON "inscripciones"("curso_id", "estado");
CREATE INDEX "inscripciones_periodo_id_estado_idx" ON "inscripciones"("periodo_id", "estado");
CREATE UNIQUE INDEX "inscripciones_estudiante_id_periodo_id_vigente_desde_key" ON "inscripciones"("estudiante_id", "periodo_id", "vigente_desde");
CREATE INDEX "horarios_ingreso_curso_id_vigente_desde_vigente_hasta_idx" ON "horarios_ingreso"("curso_id", "vigente_desde", "vigente_hasta");
CREATE UNIQUE INDEX "horarios_ingreso_curso_id_jornada_vigente_desde_key" ON "horarios_ingreso"("curso_id", "jornada", "vigente_desde");
CREATE INDEX "credenciales_qr_estudiante_id_estado_idx" ON "credenciales_qr"("estudiante_id", "estado");
CREATE INDEX "asistencias_fecha_local_curso_id_estado_idx" ON "asistencias"("fecha_local", "curso_id", "estado");
CREATE INDEX "asistencias_estudiante_id_fecha_local_idx" ON "asistencias"("estudiante_id", "fecha_local" DESC);
CREATE UNIQUE INDEX "asistencias_estudiante_id_horario_id_fecha_local_key" ON "asistencias"("estudiante_id", "horario_id", "fecha_local");
CREATE INDEX "sesiones_usuario_id_revocada_en_idx" ON "sesiones"("usuario_id", "revocada_en");
CREATE INDEX "auditoria_usuario_id_creado_en_idx" ON "auditoria"("usuario_id", "creado_en" DESC);
CREATE INDEX "auditoria_recurso_recurso_id_idx" ON "auditoria"("recurso", "recurso_id");

ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dias_no_lectivos" ADD CONSTRAINT "dias_no_lectivos_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "configuraciones_horario" ADD CONSTRAINT "configuraciones_horario_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recreos_horario" ADD CONSTRAINT "recreos_horario_configuracion_id_fkey" FOREIGN KEY ("configuracion_id") REFERENCES "configuraciones_horario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asignaciones_academicas" ADD CONSTRAINT "asignaciones_academicas_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asignaciones_academicas" ADD CONSTRAINT "asignaciones_academicas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asignaciones_academicas" ADD CONSTRAINT "asignaciones_academicas_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asignaciones_academicas" ADD CONSTRAINT "asignaciones_academicas_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_configuracion_id_fkey" FOREIGN KEY ("configuracion_id") REFERENCES "configuraciones_horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_asignacion_id_fkey" FOREIGN KEY ("asignacion_id") REFERENCES "asignaciones_academicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_ingreso" ADD CONSTRAINT "horarios_ingreso_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credenciales_qr" ADD CONSTRAINT "credenciales_qr_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "horarios_ingreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
