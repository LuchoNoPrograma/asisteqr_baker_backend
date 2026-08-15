DROP INDEX "aulas_codigo_key";

ALTER TABLE "aulas" DROP COLUMN "codigo";

CREATE UNIQUE INDEX "aulas_nombre_key" ON "aulas"("nombre");
