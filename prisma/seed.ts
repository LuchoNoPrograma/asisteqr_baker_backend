import { createHash } from "node:crypto";
import { loadEnvFile } from "node:process";
import { PrismaClient, EstadoPeriodo, Jornada } from "@prisma/client";
import * as argon2 from "argon2";

loadEnvFile();

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name} en el entorno local`);
  return value;
}

const adminPassword = requiredEnv("SEED_ADMIN_PASSWORD");
const teacherPassword = requiredEnv("SEED_TEACHER_PASSWORD");
const developmentQrToken = requiredEnv("SEED_QR_TOKEN");

async function main(): Promise<void> {
  const adminRole = await prisma.rol.upsert({
    where: { codigo: "ADMINISTRADOR" },
    update: {},
    create: { codigo: "ADMINISTRADOR", nombre: "Administrador" },
  });
  const teacherRole = await prisma.rol.upsert({
    where: { codigo: "DOCENTE" },
    update: {},
    create: { codigo: "DOCENTE", nombre: "Docente" },
  });

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
  });
  const admin = await prisma.usuario.upsert({
    where: { nombreUsuario: "admin" },
    update: {
      contrasenaHash: passwordHash,
      estado: "ACTIVO",
    },
    create: {
      nombreUsuario: "admin",
      correo: "admin@baker.edu.bo",
      nombreCompleto: "Administrador Baker",
      contrasenaHash: passwordHash,
    },
  });
  await prisma.usuarioRol.upsert({
    where: { usuarioId_rolId: { usuarioId: admin.id, rolId: adminRole.id } },
    update: {},
    create: { usuarioId: admin.id, rolId: adminRole.id },
  });
  const teacherPasswordHash = await argon2.hash(teacherPassword, {
    type: argon2.argon2id,
  });
  const teacherUser = await prisma.usuario.upsert({
    where: { nombreUsuario: "docente" },
    update: {
      contrasenaHash: teacherPasswordHash,
      estado: "ACTIVO",
    },
    create: {
      nombreUsuario: "docente",
      correo: "docente@baker.edu.bo",
      nombreCompleto: "Docente Baker",
      contrasenaHash: teacherPasswordHash,
    },
  });
  await prisma.usuarioRol.upsert({
    where: {
      usuarioId_rolId: {
        usuarioId: teacherUser.id,
        rolId: teacherRole.id,
      },
    },
    update: {},
    create: { usuarioId: teacherUser.id, rolId: teacherRole.id },
  });

  const period = await prisma.periodoAcademico.upsert({
    where: { id: "10000000-0000-4000-8000-000000000001" },
    update: { estado: EstadoPeriodo.ACTIVO },
    create: {
      id: "10000000-0000-4000-8000-000000000001",
      nombre: "Segundo semestre",
      gestion: 2026,
      fechaInicio: new Date("2026-07-01T00:00:00Z"),
      fechaFin: new Date("2026-12-15T00:00:00Z"),
      estado: EstadoPeriodo.ACTIVO,
    },
  });
  const course = await prisma.curso.upsert({
    where: {
      nivel_paralelo_gestion: {
        nivel: "4.º Secundaria",
        paralelo: "B",
        gestion: 2026,
      },
    },
    update: {},
    create: {
      nombre: "4.º Secundaria B",
      nivel: "4.º Secundaria",
      paralelo: "B",
      gestion: 2026,
    },
  });
  const generalSchedule = await prisma.configuracionHorario.upsert({
    where: { periodoId: period.id },
    update: {
      horaInicio: new Date("1970-01-01T07:30:00Z"),
      horaFin: new Date("1970-01-01T13:30:00Z"),
      intervaloMinutos: 30,
      toleranciaMinutos: 5,
      zonaHoraria: "America/La_Paz",
    },
    create: {
      periodoId: period.id,
      horaInicio: new Date("1970-01-01T07:30:00Z"),
      horaFin: new Date("1970-01-01T13:30:00Z"),
      intervaloMinutos: 30,
      toleranciaMinutos: 5,
      zonaHoraria: "America/La_Paz",
    },
  });
  await prisma.recreoHorario.deleteMany({
    where: { configuracionId: generalSchedule.id },
  });
  await prisma.recreoHorario.create({
    data: {
      configuracionId: generalSchedule.id,
      nombre: "RECREO GENERAL",
      horaInicio: new Date("1970-01-01T10:00:00Z"),
      horaFin: new Date("1970-01-01T10:30:00Z"),
    },
  });
  const subject = await prisma.materia.upsert({
    where: { codigo: "MAT" },
    update: { nombre: "MATEMÁTICA", activo: true },
    create: { codigo: "MAT", nombre: "MATEMÁTICA" },
  });
  await prisma.materia.upsert({
    where: { codigo: "FIS" },
    update: { nombre: "FÍSICA", activo: true },
    create: { codigo: "FIS", nombre: "FÍSICA" },
  });
  await prisma.materia.upsert({
    where: { codigo: "LEN" },
    update: { nombre: "LENGUAJE", activo: true },
    create: { codigo: "LEN", nombre: "LENGUAJE" },
  });
  const classroom = await prisma.aula.upsert({
    where: { codigo: "4B" },
    update: { nombre: "Aula 4.º B", capacidad: 35, activo: true },
    create: { codigo: "4B", nombre: "Aula 4.º B", capacidad: 35 },
  });
  await prisma.aula.upsert({
    where: { codigo: "LAB-FIS" },
    update: { nombre: "Laboratorio de Física", capacidad: 24, activo: true },
    create: {
      codigo: "LAB-FIS",
      nombre: "Laboratorio de Física",
      capacidad: 24,
    },
  });
  const schedule = await prisma.horarioIngreso.upsert({
    where: { cursoId_jornada: { cursoId: course.id, jornada: Jornada.MANANA } },
    update: {
      horaLimite: new Date("1970-01-01T08:00:00Z"),
      toleranciaMinutos: 0,
      zonaHoraria: "America/La_Paz",
    },
    create: {
      cursoId: course.id,
      jornada: Jornada.MANANA,
      horaLimite: new Date("1970-01-01T08:00:00Z"),
      toleranciaMinutos: 0,
      zonaHoraria: "America/La_Paz",
    },
  });
  const student = await prisma.estudiante.upsert({
    where: { id: "20000000-0000-4000-8000-000000000001" },
    update: {
      nombres: "VALERIA",
      apellidos: "MENDOZA ROJAS",
      fechaNacimiento: new Date("2010-05-14T00:00:00.000Z"),
      nombreTutor: "ANA ROJAS",
      telefonoTutor: "71234567",
    },
    create: {
      id: "20000000-0000-4000-8000-000000000001",
      nombres: "VALERIA",
      apellidos: "MENDOZA ROJAS",
      numeroDocumento: "9876543",
      fechaNacimiento: new Date("2010-05-14T00:00:00.000Z"),
      nombreTutor: "ANA ROJAS",
      telefonoTutor: "71234567",
    },
  });
  const teacher = await prisma.docente.upsert({
    where: { id: "30000000-0000-4000-8000-000000000001" },
    update: {
      nombres: "MARÍA ELENA",
      apellidos: "RODRÍGUEZ FLORES",
      especialidad: "MATEMÁTICA Y FÍSICA",
    },
    create: {
      id: "30000000-0000-4000-8000-000000000001",
      numeroDocumento: "4567890",
      nombres: "MARÍA ELENA",
      apellidos: "RODRÍGUEZ FLORES",
      especialidad: "MATEMÁTICA Y FÍSICA",
      correo: "m.rodriguez@baker.edu.bo",
      telefono: "70112233",
      creadoPor: admin.id,
    },
  });
  await prisma.docenteCurso.upsert({
    where: {
      docenteId_cursoId: { docenteId: teacher.id, cursoId: course.id },
    },
    update: {},
    create: { docenteId: teacher.id, cursoId: course.id },
  });
  await prisma.horarioClase.upsert({
    where: { id: "40000000-0000-4000-8000-000000000001" },
    update: {
      configuracionId: generalSchedule.id,
      docenteId: teacher.id,
      cursoId: course.id,
      materiaId: subject.id,
      aulaId: classroom.id,
      materia: "MATEMÁTICA",
      diaSemana: 1,
      horaInicio: new Date("1970-01-01T08:00:00Z"),
      horaFin: new Date("1970-01-01T09:30:00Z"),
      activo: true,
    },
    create: {
      id: "40000000-0000-4000-8000-000000000001",
      configuracionId: generalSchedule.id,
      docenteId: teacher.id,
      cursoId: course.id,
      materiaId: subject.id,
      aulaId: classroom.id,
      materia: "MATEMÁTICA",
      diaSemana: 1,
      horaInicio: new Date("1970-01-01T08:00:00Z"),
      horaFin: new Date("1970-01-01T09:30:00Z"),
      creadoPor: admin.id,
    },
  });
  await prisma.inscripcion.upsert({
    where: {
      estudianteId_periodoId: {
        estudianteId: student.id,
        periodoId: period.id,
      },
    },
    update: { cursoId: course.id },
    create: {
      estudianteId: student.id,
      periodoId: period.id,
      cursoId: course.id,
    },
  });
  await prisma.credencialQr.deleteMany({
    where: { estudianteId: student.id },
  });
  const tokenHash = createHash("sha256")
    .update(developmentQrToken)
    .digest("hex");
  await prisma.credencialQr.upsert({
    where: { tokenHash },
    update: { estudianteId: student.id },
    create: { estudianteId: student.id, tokenHash },
  });

  void schedule;
  process.stdout.write("Semilla de desarrollo creada.\n");
}

main().finally(async () => prisma.$disconnect());
