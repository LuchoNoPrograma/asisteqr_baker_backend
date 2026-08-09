DROP INDEX "horarios_clase_curso_id_dia_semana_hora_inicio_key";
DROP INDEX "horarios_clase_docente_id_dia_semana_hora_inicio_key";

ALTER TABLE "horarios_clase"
  ADD COLUMN "aula_id" UUID,
  ADD COLUMN "configuracion_id" UUID,
  ADD COLUMN "materia_id" UUID;

CREATE TABLE "configuraciones_horario" (
  "id" UUID NOT NULL,
  "periodo_id" UUID NOT NULL,
  "hora_inicio" TIME(0) NOT NULL,
  "hora_fin" TIME(0) NOT NULL,
  "intervalo_minutos" INTEGER NOT NULL DEFAULT 30,
  "tolerancia_minutos" INTEGER NOT NULL DEFAULT 5,
  "zona_horaria" VARCHAR(80) NOT NULL DEFAULT 'America/La_Paz',
  "version" INTEGER NOT NULL DEFAULT 1,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "configuraciones_horario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "configuraciones_horario_rango_check" CHECK ("hora_fin" > "hora_inicio"),
  CONSTRAINT "configuraciones_horario_intervalo_check" CHECK ("intervalo_minutos" = 30),
  CONSTRAINT "configuraciones_horario_tolerancia_check" CHECK ("tolerancia_minutos" BETWEEN 0 AND 120),
  CONSTRAINT "configuraciones_horario_version_check" CHECK ("version" > 0)
);

CREATE TABLE "recreos_horario" (
  "id" UUID NOT NULL,
  "configuracion_id" UUID NOT NULL,
  "nombre" VARCHAR(80) NOT NULL,
  "hora_inicio" TIME(0) NOT NULL,
  "hora_fin" TIME(0) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recreos_horario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recreos_horario_rango_check" CHECK ("hora_fin" > "hora_inicio")
);

CREATE TABLE "materias" (
  "id" UUID NOT NULL,
  "codigo" VARCHAR(30) NOT NULL,
  "nombre" VARCHAR(120) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "materias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aulas" (
  "id" UUID NOT NULL,
  "codigo" VARCHAR(30) NOT NULL,
  "nombre" VARCHAR(120) NOT NULL,
  "capacidad" INTEGER,
  "ubicacion" VARCHAR(160),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "aulas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aulas_capacidad_check" CHECK ("capacidad" IS NULL OR "capacidad" > 0)
);

CREATE UNIQUE INDEX "configuraciones_horario_periodo_id_key"
  ON "configuraciones_horario"("periodo_id");
CREATE INDEX "recreos_horario_configuracion_id_activo_hora_inicio_idx"
  ON "recreos_horario"("configuracion_id", "activo", "hora_inicio");
CREATE UNIQUE INDEX "materias_codigo_key" ON "materias"("codigo");
CREATE UNIQUE INDEX "materias_nombre_key" ON "materias"("nombre");
CREATE INDEX "materias_activo_nombre_idx" ON "materias"("activo", "nombre");
CREATE UNIQUE INDEX "aulas_codigo_key" ON "aulas"("codigo");
CREATE INDEX "aulas_activo_nombre_idx" ON "aulas"("activo", "nombre");
CREATE INDEX "horarios_clase_docente_id_dia_semana_hora_inicio_idx"
  ON "horarios_clase"("docente_id", "dia_semana", "hora_inicio");
CREATE INDEX "horarios_clase_curso_id_dia_semana_hora_inicio_idx"
  ON "horarios_clase"("curso_id", "dia_semana", "hora_inicio");
CREATE INDEX "horarios_clase_configuracion_id_activo_dia_semana_hora_inic_idx"
  ON "horarios_clase"("configuracion_id", "activo", "dia_semana", "hora_inicio");
CREATE INDEX "horarios_clase_aula_id_dia_semana_hora_inicio_idx"
  ON "horarios_clase"("aula_id", "dia_semana", "hora_inicio");

ALTER TABLE "configuraciones_horario"
  ADD CONSTRAINT "configuraciones_horario_periodo_id_fkey"
  FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recreos_horario"
  ADD CONSTRAINT "recreos_horario_configuracion_id_fkey"
  FOREIGN KEY ("configuracion_id") REFERENCES "configuraciones_horario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "horarios_clase"
  ADD CONSTRAINT "horarios_clase_configuracion_id_fkey"
  FOREIGN KEY ("configuracion_id") REFERENCES "configuraciones_horario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase"
  ADD CONSTRAINT "horarios_clase_materia_id_fkey"
  FOREIGN KEY ("materia_id") REFERENCES "materias"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase"
  ADD CONSTRAINT "horarios_clase_aula_id_fkey"
  FOREIGN KEY ("aula_id") REFERENCES "aulas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
