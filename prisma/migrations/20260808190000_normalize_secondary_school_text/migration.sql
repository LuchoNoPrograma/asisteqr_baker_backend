UPDATE "estudiantes"
SET
  "nombres" = upper(regexp_replace(btrim("nombres"), '[[:space:]]+', ' ', 'g')),
  "apellidos" = upper(regexp_replace(btrim("apellidos"), '[[:space:]]+', ' ', 'g')),
  "numero_documento" = CASE
    WHEN "numero_documento" IS NULL THEN NULL
    ELSE upper(regexp_replace(btrim("numero_documento"), '[[:space:]]+', ' ', 'g'))
  END,
  "nombre_tutor" = CASE
    WHEN "nombre_tutor" IS NULL THEN NULL
    ELSE upper(regexp_replace(btrim("nombre_tutor"), '[[:space:]]+', ' ', 'g'))
  END,
  "telefono_tutor" = CASE
    WHEN "telefono_tutor" IS NULL THEN NULL
    ELSE regexp_replace(btrim("telefono_tutor"), '[[:space:]]+', ' ', 'g')
  END;

UPDATE "docentes"
SET
  "nombres" = upper(regexp_replace(btrim("nombres"), '[[:space:]]+', ' ', 'g')),
  "apellidos" = upper(regexp_replace(btrim("apellidos"), '[[:space:]]+', ' ', 'g')),
  "numero_documento" = CASE
    WHEN "numero_documento" IS NULL THEN NULL
    ELSE upper(regexp_replace(btrim("numero_documento"), '[[:space:]]+', ' ', 'g'))
  END,
  "especialidad" = upper(regexp_replace(btrim("especialidad"), '[[:space:]]+', ' ', 'g')),
  "correo" = CASE
    WHEN "correo" IS NULL THEN NULL
    ELSE lower(btrim("correo"))
  END,
  "telefono" = CASE
    WHEN "telefono" IS NULL THEN NULL
    ELSE regexp_replace(btrim("telefono"), '[[:space:]]+', ' ', 'g')
  END;

UPDATE "cursos"
SET
  "nivel" = substring(btrim("nivel") FROM '^([1-6][.]º)') || ' Secundaria',
  "paralelo" = upper(btrim("paralelo"))
WHERE btrim("nivel") ~* '^[1-6][.]º (Primaria|Secundaria)$';

UPDATE "cursos"
SET "nombre" = "nivel" || ' ' || "paralelo";
