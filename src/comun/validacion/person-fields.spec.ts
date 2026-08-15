import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateStudentDto } from "../../modulos/estudiantes/aplicacion/dto/create-student.dto";
import { CreateTeacherDto } from "../../modulos/docentes/aplicacion/dto/create-teacher.dto";
import { CreateCourseDto } from "../../modulos/cursos/aplicacion/dto/create-course.dto";

describe("validación de personas", () => {
  it("rechaza números en nombres de estudiantes", async () => {
    const dto = plainToInstance(CreateStudentDto, {
      nombres: "Juan 2",
      apellidos: "Pérez",
      fechaNacimiento: "2012-04-10",
      nombreTutor: "Ana Pérez",
      cursoId: "10000000-0000-4000-8000-000000000001",
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "nombres")).toBe(true);
  });

  it("acepta nombres compuestos y exige especialidad docente", async () => {
    const dto = plainToInstance(CreateTeacherDto, {
      nombres: "María-José",
      apellidos: "O'Connor Flores",
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "nombres")).toBe(false);
    expect(errors.some((error) => error.property === "especialidad")).toBe(
      true,
    );
    expect(dto.nombres).toBe("MARÍA-JOSÉ");
    expect(dto.apellidos).toBe("O'CONNOR FLORES");
  });

  it("normaliza texto escolar y rechaza niveles de primaria", async () => {
    const secondary = plainToInstance(CreateCourseDto, {
      nombre: "ignorado",
      nivel: "4.º Secundaria",
      paralelo: "  b  ",
      gestion: 2026,
    });
    const primary = plainToInstance(CreateCourseDto, {
      nombre: "ignorado",
      nivel: "4.º Primaria",
      paralelo: "A",
      gestion: 2026,
    });

    expect(await validate(secondary)).toHaveLength(0);
    expect(secondary.paralelo).toBe("B");
    expect(
      (await validate(primary)).some((error) => error.property === "nivel"),
    ).toBe(true);
  });
});
