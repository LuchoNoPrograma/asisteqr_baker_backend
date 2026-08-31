import { loadEnvFile } from "node:process";
import {
  EstadoAsistencia,
  EstadoCredencial,
  EstadoEstudiante,
  EstadoInscripcion,
  EstadoPeriodo,
  Jornada,
  Prisma,
  PrismaClient,
} from "@prisma/client";
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

const studentNames = [
  "ADRIANA",
  "ALEJANDRO",
  "ALEJANDRA",
  "ÁLVARO",
  "AMARU",
  "ANDREA",
  "ANDRÉS",
  "ÁNGELA",
  "BENJAMÍN",
  "BIANCA",
  "BRUNO",
  "CAMILA",
  "CARLA",
  "CARLOS",
  "CARMEN",
  "CÉSAR",
  "CLAUDIA",
  "CRISTIAN",
  "DANIELA",
  "DAVID",
  "DAYANA",
  "DIEGO",
  "EDUARDO",
  "ELENA",
  "ELISA",
  "EMILIA",
  "ESTEBAN",
  "FABIÁN",
  "FERNANDA",
  "GABRIEL",
  "GABRIELA",
  "GONZALO",
  "GUADALUPE",
  "HUGO",
  "IAN",
  "INGRID",
  "ISABEL",
  "VALERIA",
  "JIMENA",
  "JOAQUÍN",
  "JORGE",
  "JOSÉ",
  "JUAN",
  "JULIA",
  "KEVIN",
  "LAURA",
  "LEONARDO",
  "LETICIA",
  "LUCÍA",
  "LUIS",
  "LUZ",
  "MARCELO",
  "MARCO",
  "MARIANA",
  "MATEO",
  "MAURICIO",
  "MICAELA",
  "MIGUEL",
  "NATALIA",
  "NICOLÁS",
  "NOELIA",
  "ÓSCAR",
  "PAOLA",
  "PATRICIA",
  "PEDRO",
  "RAFAEL",
  "RAÚL",
  "RENATA",
  "RODRIGO",
  "ROMINA",
  "SAMUEL",
  "SANTIAGO",
  "SARA",
  "SEBASTIÁN",
  "JAVIER",
] as const;

const paternalSurnames = [
  "QUISPE",
  "MAMANI",
  "CHOQUE",
  "HUANCA",
  "CONDORI",
  "VARGAS",
  "FLORES",
  "ROJAS",
  "APAZA",
  "TICONA",
  "COLQUE",
  "CALLISAYA",
  "LIMACHI",
  "YUJRA",
  "POMA",
] as const;

const maternalSurnames = [
  "TORREZ",
  "GUTIÉRREZ",
  "SALAZAR",
  "AGUILAR",
  "CÁCERES",
] as const;

async function inBatches<T, R>(
  items: T[],
  batchSize: number,
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(
      ...(await Promise.all(
        items.slice(index, index + batchSize).map(operation),
      )),
    );
  }
  return results;
}

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
  const courseFixtures = Array.from({ length: 6 }, (_, index) => ({
    nombre: `${index + 1}.º Secundaria A`,
    nivel: `${index + 1}.º Secundaria`,
    paralelo: "A",
    gestion: 2026,
  }));
  const fourthCourseKey = {
    nivel: "4.º Secundaria",
    paralelo: "A",
    gestion: 2026,
  };
  const existingFourthCourse = await prisma.curso.findUnique({
    where: { nivel_paralelo_gestion: fourthCourseKey },
  });
  if (!existingFourthCourse) {
    const legacyFourthCourse = await prisma.curso.findUnique({
      where: {
        nivel_paralelo_gestion: {
          nivel: "4.º Secundaria",
          paralelo: "B",
          gestion: 2026,
        },
      },
    });
    if (legacyFourthCourse) {
      await prisma.curso.update({
        where: { id: legacyFourthCourse.id },
        data: {
          nombre: "4.º Secundaria A",
          paralelo: "A",
          activo: true,
        },
      });
    }
  }
  const courses = await Promise.all(
    courseFixtures.map((fixture) =>
      prisma.curso.upsert({
        where: {
          nivel_paralelo_gestion: {
            nivel: fixture.nivel,
            paralelo: fixture.paralelo,
            gestion: fixture.gestion,
          },
        },
        update: { nombre: fixture.nombre, activo: true },
        create: fixture,
      }),
    ),
  );
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
  const existingRecesses = await prisma.recreoHorario.findMany({
    where: { configuracionId: generalSchedule.id },
    orderBy: { id: "asc" },
  });
  const recessData = {
    nombre: "RECREO GENERAL",
    horaInicio: new Date("1970-01-01T10:00:00Z"),
    horaFin: new Date("1970-01-01T10:30:00Z"),
    activo: true,
  };
  if (existingRecesses[0]) {
    await prisma.recreoHorario.update({
      where: { id: existingRecesses[0].id },
      data: recessData,
    });
    const duplicateRecessIds = existingRecesses.slice(1).map((item) => item.id);
    if (duplicateRecessIds.length) {
      await prisma.recreoHorario.updateMany({
        where: { id: { in: duplicateRecessIds } },
        data: { activo: false },
      });
    }
  } else {
    await prisma.recreoHorario.create({
      data: { configuracionId: generalSchedule.id, ...recessData },
    });
  }
  const subjectNames = [
    "LENGUAJE",
    "CIENCIAS SOCIALES",
    "MATEMÁTICA",
    "FÍSICA",
    "QUÍMICA",
    "EDUCACIÓN FÍSICA",
  ] as const;
  const subjects = await Promise.all(
    subjectNames.map((nombre) =>
      prisma.materia.upsert({
        where: { nombre },
        update: { activo: true },
        create: { nombre },
      }),
    ),
  );
  const subjectByName = new Map(
    subjects.map((subjectItem) => [subjectItem.nombre, subjectItem]),
  );

  const targetFourthClassroom = "Aula 4.º Secundaria A";
  const existingTargetFourthClassroom = await prisma.aula.findUnique({
    where: { nombre: targetFourthClassroom },
  });
  if (!existingTargetFourthClassroom) {
    const legacyFourthClassroom = await prisma.aula.findUnique({
      where: { nombre: "Aula 4.º B" },
    });
    if (legacyFourthClassroom) {
      await prisma.aula.update({
        where: { id: legacyFourthClassroom.id },
        data: {
          nombre: targetFourthClassroom,
          capacidad: 35,
          ubicacion: "Bloque Secundaria",
          activo: true,
        },
      });
    }
  }
  const homerooms = await Promise.all(
    courses.map((courseItem) =>
      prisma.aula.upsert({
        where: { nombre: `Aula ${courseItem.nivel} A` },
        update: {
          capacidad: 35,
          ubicacion: "Bloque Secundaria",
          activo: true,
        },
        create: {
          nombre: `Aula ${courseItem.nivel} A`,
          capacidad: 35,
          ubicacion: "Bloque Secundaria",
        },
      }),
    ),
  );
  const physicsLab = await prisma.aula.upsert({
    where: { nombre: "Laboratorio de Física" },
    update: {
      capacidad: 30,
      ubicacion: "Bloque de Laboratorios",
      activo: true,
    },
    create: {
      nombre: "Laboratorio de Física",
      capacidad: 30,
      ubicacion: "Bloque de Laboratorios",
    },
  });
  const chemistryLab = await prisma.aula.upsert({
    where: { nombre: "Laboratorio de Química" },
    update: {
      capacidad: 30,
      ubicacion: "Bloque de Laboratorios",
      activo: true,
    },
    create: {
      nombre: "Laboratorio de Química",
      capacidad: 30,
      ubicacion: "Bloque de Laboratorios",
    },
  });
  const sportsField = await prisma.aula.upsert({
    where: { nombre: "Cancha Polifuncional" },
    update: { capacidad: 60, ubicacion: "Patio central", activo: true },
    create: {
      nombre: "Cancha Polifuncional",
      capacidad: 60,
      ubicacion: "Patio central",
    },
  });

  const entrySchedules = await Promise.all(
    courses.map((courseItem) =>
      prisma.horarioIngreso.upsert({
        where: {
          cursoId_jornada_vigenteDesde: {
            cursoId: courseItem.id,
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
          cursoId: courseItem.id,
          jornada: Jornada.MANANA,
          horaLimite: new Date("1970-01-01T08:00:00Z"),
          toleranciaMinutos: 0,
          zonaHoraria: "America/La_Paz",
          vigenteDesde: period.fechaInicio,
        },
      }),
    ),
  );
  const studentsPerCourse = [12, 14, 11, 15, 10, 13] as const;
  const totalStudents = studentsPerCourse.reduce(
    (total, count) => total + count,
    0,
  );
  if (totalStudents !== studentNames.length) {
    throw new Error(
      "La cohorte demo debe tener un nombre único por estudiante",
    );
  }
  const studentFixtures: Array<{
    fixtureIndex: number;
    courseIndex: number;
    courseId: number;
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
    fechaNacimiento: Date;
    nombreTutor: string;
    telefonoTutor: string;
  }> = [];
  let fixtureIndex = 0;
  for (const [courseIndex, count] of studentsPerCourse.entries()) {
    for (let studentIndex = 0; studentIndex < count; studentIndex += 1) {
      const paternal = paternalSurnames[fixtureIndex % paternalSurnames.length];
      const maternal =
        maternalSurnames[
          Math.floor(fixtureIndex / paternalSurnames.length) %
            maternalSurnames.length
        ];
      const birthYear = 2013 - courseIndex;
      const birthMonth = fixtureIndex % 12;
      const birthDay = (fixtureIndex % 27) + 1;
      studentFixtures.push({
        fixtureIndex,
        courseIndex,
        courseId: courses[courseIndex].id,
        numeroDocumento:
          fixtureIndex === 37 ? "9876543" : String(8_100_001 + fixtureIndex),
        nombres: studentNames[fixtureIndex],
        apellidos: `${paternal} ${maternal}`,
        fechaNacimiento: new Date(Date.UTC(birthYear, birthMonth, birthDay)),
        nombreTutor: `${studentNames[(fixtureIndex + 19) % studentNames.length]} ${maternal}`,
        telefonoTutor: String(72_000_001 + fixtureIndex),
      });
      fixtureIndex += 1;
    }
  }
  const students = await inBatches(studentFixtures, 12, (fixture) =>
    prisma.estudiante.upsert({
      where: { numeroDocumento: fixture.numeroDocumento },
      update: {
        nombres: fixture.nombres,
        apellidos: fixture.apellidos,
        fechaNacimiento: fixture.fechaNacimiento,
        nombreTutor: fixture.nombreTutor,
        telefonoTutor: fixture.telefonoTutor,
        estado: EstadoEstudiante.ACTIVO,
      },
      create: {
        numeroDocumento: fixture.numeroDocumento,
        nombres: fixture.nombres,
        apellidos: fixture.apellidos,
        fechaNacimiento: fixture.fechaNacimiento,
        nombreTutor: fixture.nombreTutor,
        telefonoTutor: fixture.telefonoTutor,
      },
    }),
  );
  const teacherFixtures = [
    {
      materia: "LENGUAJE",
      numeroDocumento: "9001001",
      nombres: "ANA LUCÍA",
      apellidos: "QUISPE VARGAS",
      especialidad: "LENGUAJE Y LITERATURA",
      correo: "ana.quispe@baker.edu.bo",
      telefono: "70001001",
    },
    {
      materia: "CIENCIAS SOCIALES",
      numeroDocumento: "9001002",
      nombres: "CARLOS EDUARDO",
      apellidos: "MAMANI FLORES",
      especialidad: "CIENCIAS SOCIALES",
      correo: "carlos.mamani@baker.edu.bo",
      telefono: "70001002",
    },
    {
      materia: "MATEMÁTICA",
      numeroDocumento: "4567890",
      nombres: "MARÍA ELENA",
      apellidos: "RODRÍGUEZ FLORES",
      especialidad: "MATEMÁTICA",
      correo: "m.rodriguez@baker.edu.bo",
      telefono: "70112233",
    },
    {
      materia: "FÍSICA",
      numeroDocumento: "9001004",
      nombres: "JORGE LUIS",
      apellidos: "CHOQUE SALINAS",
      especialidad: "FÍSICA",
      correo: "jorge.choque@baker.edu.bo",
      telefono: "70001004",
    },
    {
      materia: "QUÍMICA",
      numeroDocumento: "9001005",
      nombres: "PATRICIA ALEJANDRA",
      apellidos: "ROJAS CONDORI",
      especialidad: "QUÍMICA",
      correo: "patricia.rojas@baker.edu.bo",
      telefono: "70001005",
    },
    {
      materia: "EDUCACIÓN FÍSICA",
      numeroDocumento: "9001006",
      nombres: "DIEGO FERNANDO",
      apellidos: "VARGAS LIMA",
      especialidad: "EDUCACIÓN FÍSICA",
      correo: "diego.vargas@baker.edu.bo",
      telefono: "70001006",
    },
  ] as const;
  const teachers = await Promise.all(
    teacherFixtures.map((fixture) =>
      prisma.docente.upsert({
        where: { numeroDocumento: fixture.numeroDocumento },
        update: {
          nombres: fixture.nombres,
          apellidos: fixture.apellidos,
          especialidad: fixture.especialidad,
          correo: fixture.correo,
          telefono: fixture.telefono,
          estado: "ACTIVO",
          actualizadoPor: admin.id,
        },
        create: {
          numeroDocumento: fixture.numeroDocumento,
          nombres: fixture.nombres,
          apellidos: fixture.apellidos,
          especialidad: fixture.especialidad,
          correo: fixture.correo,
          telefono: fixture.telefono,
          creadoPor: admin.id,
        },
      }),
    ),
  );
  const teacherBySubject = new Map<string, (typeof teachers)[number]>(
    teacherFixtures.map((fixture, index) => [fixture.materia, teachers[index]]),
  );

  const scheduleSlots = [
    { diaSemana: 1, horaInicio: "07:30", horaFin: "08:30" },
    { diaSemana: 1, horaInicio: "08:30", horaFin: "09:30" },
    { diaSemana: 1, horaInicio: "10:30", horaFin: "11:30" },
    { diaSemana: 2, horaInicio: "07:30", horaFin: "08:30" },
    { diaSemana: 2, horaInicio: "08:30", horaFin: "09:30" },
    { diaSemana: 2, horaInicio: "10:30", horaFin: "11:30" },
    { diaSemana: 3, horaInicio: "07:30", horaFin: "08:30" },
    { diaSemana: 3, horaInicio: "10:30", horaFin: "11:30" },
    { diaSemana: 4, horaInicio: "07:30", horaFin: "08:30" },
    { diaSemana: 4, horaInicio: "10:30", horaFin: "11:30" },
    { diaSemana: 5, horaInicio: "07:30", horaFin: "08:30" },
    { diaSemana: 5, horaInicio: "10:30", horaFin: "11:30" },
  ] as const;
  const timeValue = (value: string) => new Date(`1970-01-01T${value}:00Z`);

  await prisma.$transaction(
    async (tx) => {
      const assignments = await Promise.all(
        courses.flatMap((courseItem) =>
          subjects.map((subjectItem) => {
            const teacherItem = teacherBySubject.get(subjectItem.nombre)!;
            return tx.asignacionAcademica.upsert({
              where: {
                periodoId_cursoId_materiaId: {
                  periodoId: period.id,
                  cursoId: courseItem.id,
                  materiaId: subjectItem.id,
                },
              },
              update: {
                docenteId: teacherItem.id,
                minutosSemanales: 120,
                activo: true,
              },
              create: {
                periodoId: period.id,
                cursoId: courseItem.id,
                materiaId: subjectItem.id,
                docenteId: teacherItem.id,
                minutosSemanales: 120,
              },
            });
          }),
        ),
      );
      const assignmentByKey = new Map(
        assignments.map((assignmentItem) => [
          `${assignmentItem.cursoId}|${assignmentItem.materiaId}`,
          assignmentItem,
        ]),
      );
      const homeroomByCourse = new Map(
        courses.map((courseItem, index) => [courseItem.id, homerooms[index]]),
      );
      const classroomFor = (courseId: number, subjectName: string) => {
        if (subjectName === "FÍSICA") return physicsLab;
        if (subjectName === "QUÍMICA") return chemistryLab;
        if (subjectName === "EDUCACIÓN FÍSICA") return sportsField;
        return homeroomByCourse.get(courseId)!;
      };
      const targetBlocks = courses.flatMap((courseItem, courseIndex) =>
        scheduleSlots.map((slot, roundIndex) => {
          const subjectName =
            subjectNames[(courseIndex + roundIndex) % subjectNames.length];
          const subjectItem = subjectByName.get(subjectName)!;
          const teacherItem = teacherBySubject.get(subjectName)!;
          const assignmentItem = assignmentByKey.get(
            `${courseItem.id}|${subjectItem.id}`,
          )!;
          return {
            configuracionId: generalSchedule.id,
            asignacionId: assignmentItem.id,
            docenteId: teacherItem.id,
            cursoId: courseItem.id,
            materiaId: subjectItem.id,
            aulaId: classroomFor(courseItem.id, subjectName).id,
            materia: subjectName,
            diaSemana: slot.diaSemana,
            horaInicio: timeValue(slot.horaInicio),
            horaFin: timeValue(slot.horaFin),
            activo: true,
            creadoPor: admin.id,
          };
        }),
      );
      const assignmentIds = assignments.map((item) => item.id);
      const existingBlocks = await tx.horarioClase.findMany({
        where: {
          configuracionId: generalSchedule.id,
          asignacionId: { in: assignmentIds },
        },
        orderBy: { id: "asc" },
      });
      const existingByKey = new Map<string, typeof existingBlocks>();
      for (const block of existingBlocks) {
        const key = `${block.asignacionId}|${block.diaSemana}|${block.horaInicio.toISOString().slice(11, 16)}`;
        existingByKey.set(key, [...(existingByKey.get(key) ?? []), block]);
      }
      const keptBlockIds = new Set<number>();
      const newBlocks: typeof targetBlocks = [];
      let scheduleChanged = false;
      for (const block of targetBlocks) {
        const key = `${block.asignacionId}|${block.diaSemana}|${block.horaInicio.toISOString().slice(11, 16)}`;
        const candidates = existingByKey.get(key);
        const existing =
          candidates?.find((candidate) => candidate.activo) ?? candidates?.[0];
        if (!existing) {
          newBlocks.push(block);
          scheduleChanged = true;
          continue;
        }
        keptBlockIds.add(existing.id);
        const changed =
          existing.configuracionId !== block.configuracionId ||
          existing.asignacionId !== block.asignacionId ||
          existing.docenteId !== block.docenteId ||
          existing.cursoId !== block.cursoId ||
          existing.materiaId !== block.materiaId ||
          existing.aulaId !== block.aulaId ||
          existing.materia !== block.materia ||
          existing.diaSemana !== block.diaSemana ||
          existing.horaInicio.getTime() !== block.horaInicio.getTime() ||
          existing.horaFin.getTime() !== block.horaFin.getTime() ||
          !existing.activo;
        if (changed) {
          scheduleChanged = true;
          await tx.horarioClase.update({
            where: { id: existing.id },
            data: block,
          });
        }
      }
      const obsoleteBlockIds = existingBlocks
        .filter((block) => block.activo && !keptBlockIds.has(block.id))
        .map((block) => block.id);
      if (obsoleteBlockIds.length) {
        scheduleChanged = true;
        await tx.horarioClase.updateMany({
          where: { id: { in: obsoleteBlockIds } },
          data: { activo: false },
        });
      }
      if (newBlocks.length)
        await tx.horarioClase.createMany({ data: newBlocks });
      if (scheduleChanged) {
        await tx.configuracionHorario.update({
          where: { id: generalSchedule.id },
          data: { version: { increment: 1 } },
        });
      }
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
  await inBatches(students, 12, (studentItem) => {
    const fixture = studentFixtures.find(
      (item) => item.numeroDocumento === studentItem.numeroDocumento,
    )!;
    return prisma.inscripcion.upsert({
      where: {
        estudianteId_periodoId_vigenteDesde: {
          estudianteId: studentItem.id,
          periodoId: period.id,
          vigenteDesde: period.fechaInicio,
        },
      },
      update: {
        cursoId: fixture.courseId,
        estado: EstadoInscripcion.ACTIVA,
        vigenteHasta: null,
      },
      create: {
        estudianteId: studentItem.id,
        periodoId: period.id,
        cursoId: fixture.courseId,
        estado: EstadoInscripcion.ACTIVA,
        vigenteDesde: period.fechaInicio,
      },
    });
  });

  const studentIds = students.map((studentItem) => studentItem.id);
  const currentCredentials = await prisma.credencialQr.findMany({
    where: {
      estudianteId: { in: studentIds },
      estado: EstadoCredencial.ACTIVA,
      esPrincipal: true,
    },
    select: { estudianteId: true },
  });
  const credentialStudentIds = new Set(
    currentCredentials.map((credential) => credential.estudianteId),
  );
  const missingCredentialStudentIds = studentIds.filter(
    (studentId) => !credentialStudentIds.has(studentId),
  );
  if (missingCredentialStudentIds.length) {
    await prisma.credencialQr.createMany({
      data: missingCredentialStudentIds.map((estudianteId) => ({
        estudianteId,
        esPrincipal: true,
        version: 3,
        estado: EstadoCredencial.ACTIVA,
      })),
    });
  }

  await prisma.diaNoLectivo.upsert({
    where: {
      periodoId_fecha: {
        periodoId: period.id,
        fecha: new Date("2026-08-21T00:00:00Z"),
      },
    },
    update: { descripcion: "Jornada pedagógica institucional" },
    create: {
      periodoId: period.id,
      fecha: new Date("2026-08-21T00:00:00Z"),
      descripcion: "Jornada pedagógica institucional",
    },
  });

  const attendanceDates = [
    "2026-08-17",
    "2026-08-18",
    "2026-08-19",
    "2026-08-20",
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-31",
  ] as const;
  const entryScheduleByCourse = new Map(
    entrySchedules.map((schedule) => [schedule.cursoId, schedule]),
  );
  const attendanceFixtures: Prisma.AsistenciaCreateManyInput[] = [];
  for (const [studentIndex, studentItem] of students.entries()) {
    const fixture = studentFixtures[studentIndex];
    const schedule = entryScheduleByCourse.get(fixture.courseId)!;
    for (const [dateIndex, date] of attendanceDates.entries()) {
      const isAbsent = (fixture.fixtureIndex + dateIndex * 3) % 13 === 0;
      if (isAbsent) continue;
      const isLate = (fixture.fixtureIndex * 2 + dateIndex) % 7 === 0;
      attendanceFixtures.push({
        estudianteId: studentItem.id,
        cursoId: fixture.courseId,
        horarioId: schedule.id,
        fechaLocal: new Date(`${date}T00:00:00Z`),
        fechaHora: new Date(`${date}T${isLate ? "12:08:00" : "11:48:00"}Z`),
        estado: isLate ? EstadoAsistencia.ATRASO : EstadoAsistencia.PUNTUAL,
        origen: fixture.fixtureIndex % 5 === 0 ? "DEMO_MANUAL" : "DEMO_QR",
        registradoPorId: admin.id,
      });
    }
  }
  await prisma.asistencia.createMany({
    data: attendanceFixtures,
    skipDuplicates: true,
  });

  const demoAudit = await prisma.auditoria.findFirst({
    where: { accion: "SEMILLA_DEMO_CARGADA", recurso: "demo" },
    select: { id: true },
  });
  const auditData = {
    usuarioId: admin.id,
    recurso: "demo",
    metadatos: {
      periodoId: period.id,
      cursos: courses.length,
      estudiantes: students.length,
      asistencias: attendanceFixtures.length,
    },
  } satisfies Prisma.AuditoriaUncheckedUpdateInput;
  if (demoAudit) {
    await prisma.auditoria.update({
      where: { id: demoAudit.id },
      data: auditData,
    });
  } else {
    await prisma.auditoria.create({
      data: {
        ...auditData,
        accion: "SEMILLA_DEMO_CARGADA",
      },
    });
  }

  process.stdout.write(
    `Semilla demo creada: ${students.length} estudiantes, 6 cursos, 6 materias, 6 docentes, 72 bloques y ${attendanceFixtures.length} asistencias históricas.\n`,
  );
}

main().finally(async () => prisma.$disconnect());
