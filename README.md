# AsisteQR Baker API

Backend NestJS + PostgreSQL para autenticación, escaneo QR, asistencia diaria, historial y reportes.

- Base local: `sistema-educativo-baker`

## Desarrollo local

```bash
cp .env.example .env
docker compose up -d postgres
npx prisma migrate dev --name inicial
npm run prisma:seed
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Los accesos y el QR de desarrollo se configuran únicamente en el `.env` local.
- PDF: `GET /api/v1/reportes/exportar/pdf?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- CRUD estudiantes: `/api/v1/estudiantes`
- CRUD docentes: `/api/v1/docentes`
- CRUD cursos: `/api/v1/cursos`
- CRUD horarios: `/api/v1/cursos/:id/horarios`
- Horarios de clase por docente: `/api/v1/horarios-clase`
- Credenciales imprimibles: `POST /api/v1/credenciales/imprimibles`

`codigo_estudiante` es un entero incremental generado por PostgreSQL. No se recibe en los DTO de creación o edición.

Las credenciales de desarrollo no se versionan. En producción se deben provisionar usuarios, contraseñas y secretos mediante el gestor de secretos del entorno.

`QR_TOKEN_SECRET` debe conservarse estable. La API deriva con HMAC los tokens
imprimibles y PostgreSQL almacena únicamente su hash.
