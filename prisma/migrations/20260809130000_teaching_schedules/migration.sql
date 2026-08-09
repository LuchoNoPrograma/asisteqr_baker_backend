CREATE TABLE "horarios_clase" (
    "id" UUID NOT NULL,
    "docente_id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "materia" VARCHAR(120) NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "creado_por" UUID,

    CONSTRAINT "horarios_clase_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "horarios_clase_dia_semana_check"
        CHECK ("dia_semana" BETWEEN 1 AND 5),
    CONSTRAINT "horarios_clase_rango_hora_check"
        CHECK ("hora_fin" > "hora_inicio"),
    CONSTRAINT "horarios_clase_docente_id_fkey"
        FOREIGN KEY ("docente_id") REFERENCES "docentes"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "horarios_clase_curso_id_fkey"
        FOREIGN KEY ("curso_id") REFERENCES "cursos"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "horarios_clase_docente_id_dia_semana_hora_inicio_key"
    ON "horarios_clase"("docente_id", "dia_semana", "hora_inicio");
CREATE UNIQUE INDEX "horarios_clase_curso_id_dia_semana_hora_inicio_key"
    ON "horarios_clase"("curso_id", "dia_semana", "hora_inicio");
CREATE INDEX "horarios_clase_activo_dia_semana_hora_inicio_idx"
    ON "horarios_clase"("activo", "dia_semana", "hora_inicio");
