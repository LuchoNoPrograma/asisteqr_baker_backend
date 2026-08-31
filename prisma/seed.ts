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
const regentPassword = process.env.SEED_REGENT_PASSWORD?.trim();

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
  const regentRole = await prisma.rol.upsert({
    where: { codigo: "REGENTE" },
    update: { nombre: "Regente" },
    create: { codigo: "REGENTE", nombre: "Regente" },
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
  if (regentPassword) {
    const regentPasswordHash = await argon2.hash(regentPassword, {
      type: argon2.argon2id,
    });
    const regentUser = await prisma.usuario.upsert({
      where: { nombreUsuario: "regente" },
      update: {
        contrasenaHash: regentPasswordHash,
        estado: "ACTIVO",
      },
      create: {
        nombreUsuario: "regente",
        correo: "regente@baker.edu.bo",
        nombreCompleto: "Regente Baker",
        contrasenaHash: regentPasswordHash,
      },
    });
    await prisma.usuarioRol.upsert({
      where: {
        usuarioId_rolId: {
          usuarioId: regentUser.id,
          rolId: regentRole.id,
        },
      },
      update: {},
      create: { usuarioId: regentUser.id, rolId: regentRole.id },
    });
  }

  const existingPeriod = await prisma.periodoAcademico.findFirst({
    where: { nombre: "Segundo semestre", gestion: 2026 },
  });
  const period = existingPeriod
    ? await prisma.periodoAcademico.update({
        where: { id: existingPeriod.id },
        data: { estado: EstadoPeriodo.ACTIVO },
      })
    : await prisma.periodoAcademico.create({
        data: {
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
      horaFin: new Date("1970-01-01T20:00:00Z"),
      intervaloMinutos: 30,
      toleranciaMinutos: 5,
      zonaHoraria: "America/La_Paz",
    },
    create: {
      periodoId: period.id,
      horaInicio: new Date("1970-01-01T07:30:00Z"),
      horaFin: new Date("1970-01-01T20:00:00Z"),
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
    where: { nombre: "MATEMÁTICA" },
    update: { activo: true },
    create: { nombre: "MATEMÁTICA" },
  });
  await prisma.materia.upsert({
    where: { nombre: "FÍSICA" },
    update: { activo: true },
    create: { nombre: "FÍSICA" },
  });
  await prisma.materia.upsert({
    where: { nombre: "LENGUAJE" },
    update: { activo: true },
    create: { nombre: "LENGUAJE" },
  });
  const classroom = await prisma.aula.upsert({
    where: { nombre: "Aula 4.º B" },
    update: { capacidad: 35, activo: true },
    create: { nombre: "Aula 4.º B", capacidad: 35 },
  });
  await prisma.aula.upsert({
    where: { nombre: "Laboratorio de Física" },
    update: { capacidad: 24, activo: true },
    create: {
      nombre: "Laboratorio de Física",
      capacidad: 24,
    },
  });
  const schedule = await prisma.horarioIngreso.upsert({
    where: {
      cursoId_jornada_vigenteDesde: {
        cursoId: course.id,
        jornada: Jornada.MANANA,
        vigenteDesde: period.fechaInicio,
      },
    },
    update: {
      horaLimite: new Date("1970-01-01T08:00:00Z"),
      toleranciaMinutos: 0,
      zonaHoraria: "America/La_Paz",
      activo: true,
      vigenteHasta: null,
    },
    create: {
      cursoId: course.id,
      jornada: Jornada.MANANA,
      horaLimite: new Date("1970-01-01T08:00:00Z"),
      toleranciaMinutos: 0,
      zonaHoraria: "America/La_Paz",
      vigenteDesde: period.fechaInicio,
    },
  });
  const student = await prisma.estudiante.upsert({
    where: { numeroDocumento: "9876543" },
    update: {
      nombres: "VALERIA",
      apellidos: "MENDOZA ROJAS",
      fechaNacimiento: new Date("2010-05-14T00:00:00.000Z"),
      nombreTutor: "ANA ROJAS",
      telefonoTutor: "71234567",
    },
    create: {
      nombres: "VALERIA",
      apellidos: "MENDOZA ROJAS",
      numeroDocumento: "9876543",
      fechaNacimiento: new Date("2010-05-14T00:00:00.000Z"),
      nombreTutor: "ANA ROJAS",
      telefonoTutor: "71234567",
    },
  });
  const teacher = await prisma.docente.upsert({
    where: { numeroDocumento: "4567890" },
    update: {
      nombres: "MARÍA ELENA",
      apellidos: "RODRÍGUEZ FLORES",
      especialidad: "MATEMÁTICA Y FÍSICA",
    },
    create: {
      numeroDocumento: "4567890",
      nombres: "MARÍA ELENA",
      apellidos: "RODRÍGUEZ FLORES",
      especialidad: "MATEMÁTICA Y FÍSICA",
      correo: "m.rodriguez@baker.edu.bo",
      telefono: "70112233",
      creadoPor: admin.id,
    },
  });
  const assignment = await prisma.asignacionAcademica.upsert({
    where: {
      periodoId_cursoId_materiaId: {
        periodoId: period.id,
        cursoId: course.id,
        materiaId: subject.id,
      },
    },
    update: {
      docenteId: teacher.id,
      minutosSemanales: 90,
      activo: true,
    },
    create: {
      periodoId: period.id,
      cursoId: course.id,
      materiaId: subject.id,
      docenteId: teacher.id,
      minutosSemanales: 90,
    },
  });
  const existingClassBlock = await prisma.horarioClase.findFirst({
    where: {
      asignacionId: assignment.id,
      diaSemana: 1,
      horaInicio: new Date("1970-01-01T08:00:00Z"),
    },
  });
  const classBlockData = {
      configuracionId: generalSchedule.id,
      asignacionId: assignment.id,
      docenteId: teacher.id,
      cursoId: course.id,
      materiaId: subject.id,
      aulaId: classroom.id,
      materia: "MATEMÁTICA",
      diaSemana: 1,
      horaInicio: new Date("1970-01-01T08:00:00Z"),
      horaFin: new Date("1970-01-01T09:30:00Z"),
      activo: true,
      creadoPor: admin.id,
  };
  if (existingClassBlock) {
    await prisma.horarioClase.update({
      where: { id: existingClassBlock.id },
      data: classBlockData,
    });
  } else {
    await prisma.horarioClase.create({ data: classBlockData });
  }
  await prisma.inscripcion.upsert({
    where: {
      estudianteId_periodoId_vigenteDesde: {
        estudianteId: student.id,
        periodoId: period.id,
        vigenteDesde: period.fechaInicio,
      },
    },
    update: {
      cursoId: course.id,
      estado: "ACTIVA",
      vigenteHasta: null,
    },
    create: {
      estudianteId: student.id,
      periodoId: period.id,
      cursoId: course.id,
      vigenteDesde: period.fechaInicio,
    },
  });
  const permanentCredential = await prisma.credencialQr.findFirst({
    where: {
      estudianteId: student.id,
      estado: "ACTIVA",
      esPrincipal: true,
    },
    select: { id: true },
  });
  if (!permanentCredential) {
    await prisma.credencialQr.create({
      data: {
        estudianteId: student.id,
        esPrincipal: true,
        version: 3,
      },
    });
  }

  void schedule;
  process.stdout.write("Semilla de desarrollo creada.\n");
}

main().finally(async () => prisma.$disconnect());
