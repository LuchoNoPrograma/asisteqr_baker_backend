CREATE TABLE "celdas_horario_curso" (
    "curso_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "celdas_horario_curso_pkey"
        PRIMARY KEY ("curso_id", "dia_semana", "hora"),
    CONSTRAINT "celdas_horario_curso_dia_semana_check"
        CHECK ("dia_semana" BETWEEN 1 AND 5),
    CONSTRAINT "celdas_horario_curso_hora_check"
        CHECK ("hora" BETWEEN 8 AND 19),
    CONSTRAINT "celdas_horario_curso_curso_id_fkey"
        FOREIGN KEY ("curso_id") REFERENCES "cursos"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
