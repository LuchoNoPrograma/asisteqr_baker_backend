-- Legacy QR hashes stay nullable so already printed credentials keep working.
ALTER TABLE "credenciales_qr"
ALTER COLUMN "token_hash" DROP NOT NULL;

ALTER TABLE "credenciales_qr"
ADD COLUMN "es_principal" BOOLEAN NOT NULL DEFAULT false;

-- Existing QR values remain active. The oldest active credential becomes the
-- stable source for future reprints, without invalidating any printed card.
WITH ranked_credentials AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "estudiante_id"
      ORDER BY "creado_en" ASC, "id" ASC
    ) AS position
  FROM "credenciales_qr"
  WHERE "estado" = 'ACTIVA'
)
UPDATE "credenciales_qr" AS credential
SET "es_principal" = true
FROM ranked_credentials AS ranked
WHERE credential."id" = ranked."id"
  AND ranked.position = 1;

CREATE UNIQUE INDEX "credenciales_qr_estudiante_principal_activa_key"
ON "credenciales_qr" ("estudiante_id")
WHERE "estado" = 'ACTIVA' AND "es_principal" = true;
