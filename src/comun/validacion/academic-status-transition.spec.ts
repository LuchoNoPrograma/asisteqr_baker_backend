import { ValidationPipe } from "@nestjs/common";
import { UpdateCourseDto } from "../../modulos/cursos/aplicacion/dto/update-course.dto";
import { UpdateTeacherDto } from "../../modulos/docentes/aplicacion/dto/update-teacher.dto";
import { UpdateStudentDto } from "../../modulos/estudiantes/aplicacion/dto/update-student.dto";

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe("transiciones académicas explícitas", () => {
  it("rechaza estado en el PATCH general de estudiantes", async () => {
    await expect(
      pipe.transform(
        { estado: "RETIRADO" },
        { type: "body", metatype: UpdateStudentDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza estado en el PATCH general de docentes", async () => {
    await expect(
      pipe.transform(
        { estado: "INACTIVO" },
        { type: "body", metatype: UpdateTeacherDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza activo en el PATCH general de cursos", async () => {
    await expect(
      pipe.transform(
        { activo: false },
        { type: "body", metatype: UpdateCourseDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
