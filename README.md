# AsisteQR Baker API

Backend NestJS + PostgreSQL para autenticación, escaneo QR, asistencia diaria, historial y reportes.

- PostgreSQL local: `127.0.0.1:5432`
- Base local: `sistema-educativo-baker`

## Desarrollo local

```bash
cp .env.example .env
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

El flujo local presupone una instancia PostgreSQL ya instalada y activa en el
puerto `5432`. La variable `DATABASE_URL` del `.env` contiene las credenciales;
no se documentan ni se copian a otros repositorios. Docker Compose no es un
requisito ni debe iniciarse por defecto.

Para crear una migración durante desarrollo se usa `npx prisma migrate dev
--name <nombre>`. `npx prisma migrate reset` elimina todos los datos y solo se
usa de forma explícita en desarrollo después de cuadrar esquema, migraciones y
semilla.

- API: `http://localhost:3000/api/v1`
- Los accesos y el QR de desarrollo se configuran únicamente en el `.env` local.
- PDF: `GET /api/v1/reportes/exportar/pdf?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- CRUD estudiantes: `/api/v1/estudiantes`
- CRUD docentes: `/api/v1/docentes`
- CRUD cursos: `/api/v1/cursos`
- CRUD horarios: `/api/v1/cursos/:id/horarios`
- Horarios de clase por docente: `/api/v1/horarios-clase`
- Credenciales imprimibles: `POST /api/v1/credenciales/imprimibles`

## Evolución de horarios

El editor matricial planificado no persistirá celdas individualmente. Flutter
cargará una proyección agregada y enviará un único `PUT` con todos los bloques
del borrador. Una operación de guardado corresponderá a una sola transacción de
PostgreSQL con bloqueo por periodo, validación de docente/curso/aula/recreos,
aplicación del diff, incremento de versión y una auditoría resumida.

Los intervalos de 30 minutos son una regla de edición y validación. PostgreSQL
almacenará bloques continuos con hora de inicio y fin, no una fila por cada
media hora.

`codigo_estudiante` es un entero incremental generado por PostgreSQL. No se recibe en los DTO de creación o edición.

Las credenciales de desarrollo no se versionan. En producción se deben provisionar usuarios, contraseñas y secretos mediante el gestor de secretos del entorno.

`QR_TOKEN_SECRET` debe conservarse estable. La API deriva con HMAC los tokens
imprimibles y PostgreSQL almacena únicamente su hash.
