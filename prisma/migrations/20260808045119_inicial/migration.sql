-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstadoEstudiante" AS ENUM ('ACTIVO', 'INACTIVO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "EstadoInscripcion" AS ENUM ('ACTIVA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('PLANIFICADO', 'ACTIVO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoCredencial" AS ENUM ('ACTIVA', 'INACTIVA', 'REVOCADA');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PUNTUAL', 'ATRASO');

-- CreateEnum
CREATE TYPE "Jornada" AS ENUM ('MANANA', 'TARDE', 'NOCHE');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "correo" VARCHAR(180) NOT NULL,
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "nombre_completo" VARCHAR(180) NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "creado_por" UUID,
    "actualizado_por" UUID,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_roles" (
    "usuario_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,

    CONSTRAINT "usuarios_roles_pkey" PRIMARY KEY ("usuario_id","rol_id")
);

-- CreateTable
CREATE TABLE "periodos_academicos" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "gestion" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "estado" "EstadoPeriodo" NOT NULL DEFAULT 'PLANIFICADO',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "periodos_academicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "nivel" VARCHAR(60) NOT NULL,
    "paralelo" VARCHAR(10) NOT NULL,
    "gestion" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudiantes" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(120) NOT NULL,
    "fotografia_url" VARCHAR(500),
    "estado" "EstadoEstudiante" NOT NULL DEFAULT 'ACTIVO',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" UUID NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "estado" "EstadoInscripcion" NOT NULL DEFAULT 'ACTIVA',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_ingreso" (
    "id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "jornada" "Jornada" NOT NULL,
    "hora_limite" TIME(0) NOT NULL,
    "tolerancia_minutos" INTEGER NOT NULL DEFAULT 0,
    "zona_horaria" VARCHAR(80) NOT NULL DEFAULT 'America/La_Paz',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "horarios_ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credenciales_qr" (
    "id" UUID NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "estado" "EstadoCredencial" NOT NULL DEFAULT 'ACTIVA',
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigente_hasta" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credenciales_qr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencias" (
    "id" UUID NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "horario_id" UUID NOT NULL,
    "fecha_local" DATE NOT NULL,
    "fecha_hora" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoAsistencia" NOT NULL,
    "origen" VARCHAR(30) NOT NULL DEFAULT 'QR',
    "registrado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "dispositivo" VARCHAR(180),
    "direccion_ip" INET,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "revocada_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "accion" VARCHAR(80) NOT NULL,
    "recurso" VARCHAR(80) NOT NULL,
    "recurso_id" VARCHAR(100),
    "metadatos" JSONB,
    "direccion_ip" INET,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "roles"("codigo");

-- CreateIndex
CREATE INDEX "usuarios_roles_rol_id_idx" ON "usuarios_roles"("rol_id");

-- CreateIndex
CREATE INDEX "periodos_academicos_estado_idx" ON "periodos_academicos"("estado");

-- CreateIndex
CREATE INDEX "cursos_activo_idx" ON "cursos"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_nivel_paralelo_gestion_key" ON "cursos"("nivel", "paralelo", "gestion");

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_codigo_key" ON "estudiantes"("codigo");

-- CreateIndex
CREATE INDEX "estudiantes_apellidos_nombres_idx" ON "estudiantes"("apellidos", "nombres");

-- CreateIndex
CREATE INDEX "estudiantes_estado_idx" ON "estudiantes"("estado");

-- CreateIndex
CREATE INDEX "inscripciones_curso_id_estado_idx" ON "inscripciones"("curso_id", "estado");

-- CreateIndex
CREATE INDEX "inscripciones_periodo_id_estado_idx" ON "inscripciones"("periodo_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_estudiante_id_periodo_id_key" ON "inscripciones"("estudiante_id", "periodo_id");

-- CreateIndex
CREATE INDEX "horarios_ingreso_activo_idx" ON "horarios_ingreso"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_ingreso_curso_id_jornada_key" ON "horarios_ingreso"("curso_id", "jornada");

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_qr_token_hash_key" ON "credenciales_qr"("token_hash");

-- CreateIndex
CREATE INDEX "credenciales_qr_estudiante_id_estado_idx" ON "credenciales_qr"("estudiante_id", "estado");

-- CreateIndex
CREATE INDEX "asistencias_fecha_local_curso_id_estado_idx" ON "asistencias"("fecha_local", "curso_id", "estado");

-- CreateIndex
CREATE INDEX "asistencias_estudiante_id_fecha_local_idx" ON "asistencias"("estudiante_id", "fecha_local" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_estudiante_id_horario_id_fecha_local_key" ON "asistencias"("estudiante_id", "horario_id", "fecha_local");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_token_hash_key" ON "sesiones"("token_hash");

-- CreateIndex
CREATE INDEX "sesiones_usuario_id_revocada_en_idx" ON "sesiones"("usuario_id", "revocada_en");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_creado_en_idx" ON "auditoria"("usuario_id", "creado_en" DESC);

-- CreateIndex
CREATE INDEX "auditoria_recurso_recurso_id_idx" ON "auditoria"("recurso", "recurso_id");

-- AddForeignKey
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_ingreso" ADD CONSTRAINT "horarios_ingreso_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credenciales_qr" ADD CONSTRAINT "credenciales_qr_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "horarios_ingreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
