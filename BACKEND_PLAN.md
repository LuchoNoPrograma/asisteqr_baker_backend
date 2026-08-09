# Plan Backend - AsisteQR Baker

Crear una API NestJS modular en `/home/nini/IdeaProjects/asisteqr_baker_backend` con PostgreSQL, nombres de tablas y columnas en espanol, reglas de asistencia transaccionales y seguridad por defecto. El servidor sera la unica autoridad para validar QR, hora, duplicados, estado y acceso a reportes.

## Scope

- In: autenticacion, usuarios/roles, CRUD de estudiantes y docentes, cursos, periodos, horarios, asistencia, reportes y auditoria simple.
- In: API REST versionada, migraciones, datos semilla y pruebas unitarias/e2e.
- Out inicial: biometria, integracion SSO, mensajeria push y almacenamiento de archivos en nube.

## Arquitectura

- `src/modulos/<modulo>/dominio`: reglas, entidades y puertos.
- `src/modulos/<modulo>/aplicacion`: casos de uso y DTO de entrada/salida.
- `src/modulos/<modulo>/infraestructura`: persistencia, controladores y adaptadores.
- `src/comun`: configuracion, filtros, guardas, decoradores, auditoria y contratos compartidos.
- Los controladores validan y delegan; no contienen SQL ni reglas de puntualidad.
- Los casos de uso dependen de contratos, no del ORM.
- Las migraciones son la fuente de verdad; `synchronize` permanece desactivado.

## Modelo PostgreSQL en espanol

- `usuarios`: `id`, `nombre_usuario`, `correo`, `contrasena_hash`, `nombre_completo`, `estado`, auditoria.
- `roles`, `permisos`, `usuarios_roles`, `roles_permisos`.
- `estudiantes`: `id`, `codigo_estudiante` entero autoincremental, documento, nombres, apellidos, fotografia, tutor y estado.
- `docentes`: datos personales, contacto, estado y auditoria; `docentes_cursos` conserva sus asignaciones.
- `cursos`: `id`, `nombre`, `nivel`, `paralelo`, `gestion`, auditoria.
- `inscripciones`: relacion estudiante-curso-periodo con vigencia.
- `periodos_academicos`: gestion, nombre, fechas y estado.
- `horarios_ingreso`: curso/jornada, hora limite, tolerancia y zona horaria.
- `credenciales_qr`: token aleatorio hasheado, estudiante, version, vigencia y estado.
- `asistencias`: estudiante, curso, horario, fecha local, instante UTC, estado y origen.
- `sesiones`: refresh token hasheado, dispositivo, expiracion y revocacion.
- `auditoria`: actor, accion, recurso, identificador, metadatos, IP e instante.

## Integridad y concurrencia

- Claves `uuid` y marcas de tiempo `timestamptz` en UTC.
- Restriccion unica de asistencia por estudiante, fecha local y horario/periodo.
- Transaccion para validar QR, resolver inscripcion/horario y crear asistencia.
- `INSERT ... ON CONFLICT` o captura de `23505` para impedir duplicados concurrentes.
- Indices en claves foraneas y filtros frecuentes: fecha, curso, estudiante y estado.
- Borrado logico solo donde sea necesario; asistencias y auditoria no se sobrescriben.

## Seguridad

- Argon2id para contrasenas y refresh tokens almacenados como hash.
- JWT de acceso corto y refresh rotatorio vinculado a sesion/dispositivo.
- RBAC por permisos: escanear, consultar asistencia, gestionar estudiantes, exportar y administrar.
- `helmet`, CORS por lista, limite de tamano, validacion estricta y rate limit por ruta/IP/usuario.
- QR opaco y aleatorio: no incluye nombre, curso ni identificadores previsibles.
- Errores sin detalles internos, logs estructurados sin contrasenas, tokens o datos sensibles.
- HTTPS obligatorio en produccion; secretos solo por variables de entorno validadas.
- Auditoria de login, fallos, escaneo, exportacion y cambios administrativos.

## Trazabilidad funcional

| Casos | Responsabilidad del backend |
|---|---|
| CP-01, CP-02, CP-04, CP-17, CP-18, CP-20 | Validar token, resolver estudiante/curso, registrar instante y devolver identidad |
| CP-03, CP-14 | Rechazar token inexistente, inactivo o no interpretable sin insertar |
| CP-05 | Unicidad transaccional e idempotencia |
| CP-06, CP-07 | Comparar hora local con horario/tolerancia configurados |
| CP-08, CP-09, CP-19 | Consulta por curso con ausentes derivados de inscripciones activas |
| CP-10, CP-11 | Agregaciones semanal y mensual con zona horaria consistente |
| CP-12, CP-13 | Historial e identidad real del propietario del QR |
| CP-15, CP-16 | JWT, sesion activa, RBAC y auditoria de denegaciones |

## Contrato inicial

- `POST /api/v1/autenticacion/iniciar-sesion`
- `POST /api/v1/autenticacion/renovar`
- `POST /api/v1/autenticacion/cerrar-sesion`
- `GET /api/v1/periodos/activo`
- `POST /api/v1/asistencias/escanear`
- `GET /api/v1/asistencias/diaria`
- `GET /api/v1/estudiantes?buscar=&cursoId=`
- `POST /api/v1/estudiantes`, `PATCH /api/v1/estudiantes/:id`, `DELETE /api/v1/estudiantes/:id`
- `GET/POST /api/v1/docentes`, `GET/PATCH/DELETE /api/v1/docentes/:id`
- `GET /api/v1/estudiantes/:id/historial`
- `GET /api/v1/reportes/resumen?desde=&hasta=&cursoId=`
- `GET /api/v1/reportes/exportar/pdf?desde=&hasta=&cursoId=`
- `GET /api/v1/cursos` y `GET /api/v1/cursos/:id/horarios`

## Action items

- [x] Crear NestJS, configuracion tipada, Docker Compose PostgreSQL y variables de entorno de ejemplo.
- [x] Implementar esquema, migracion inicial, indices, restricciones y semilla segura.
- [x] Implementar autenticacion, rotacion de refresh y RBAC.
- [x] Implementar estudiantes, cursos, periodos, inscripciones y horarios.
- [x] Implementar CRUD auditado de estudiantes sin entrada manual de codigo; PostgreSQL asigna la secuencia.
- [x] Implementar CRUD auditado de docentes y asignacion a cursos.
- [x] Implementar escaneo transaccional, puntualidad, atraso y duplicados.
- [x] Implementar ausencias derivadas, consultas e infraestructura de reportes por rango diario/semanal/mensual.
- [x] Implementar auditoria, validacion estricta y rate limit.
- [x] Implementar exportacion de reportes en PDF protegida por rol.
- [ ] Crear pruebas unitarias de reglas y e2e para CP-01 a CP-20.
- [x] Ejecutar migraciones y pruebas en PostgreSQL real, no solo mocks.
- [x] Preparar despliegue con contenedor no-root, health checks y migracion previa al arranque.

## Definition of done

- `npm run lint`, `npm test` y `npm run test:e2e` pasan.
- La base se crea exclusivamente mediante migraciones reproducibles.
- Dos solicitudes simultaneas del mismo QR producen un solo registro.
- Un usuario sin permiso recibe `403` y el intento queda auditado.
- Los reportes respetan curso, periodo, zona horaria y rol del usuario.
- Ningun secreto, token o hash aparece en respuestas ni logs.

## Decisiones iniciales

- PostgreSQL sera la base de datos y Prisma el adaptador de persistencia.
- La base local canonica se llama `sistema-educativo-baker`.
- Zona horaria escolar por defecto: `America/La_Paz`; instantes almacenados en UTC.
- Fotografias se referencian por URL autorizada; el proveedor de archivos es intercambiable.
- El primer despliegue sera local con Docker Compose y quedara listo para un host HTTPS.
