ALTER TABLE "usuarios" ADD COLUMN "nombre_usuario" VARCHAR(80);

UPDATE "usuarios"
SET "nombre_usuario" = CASE
  WHEN "correo" = 'admin@baker.edu.bo' THEN 'admin'
  ELSE 'usuario_' || SUBSTRING(REPLACE("id"::text, '-', ''), 1, 12)
END;

ALTER TABLE "usuarios" ALTER COLUMN "nombre_usuario" SET NOT NULL;

CREATE UNIQUE INDEX "usuarios_nombre_usuario_key"
ON "usuarios"("nombre_usuario");
