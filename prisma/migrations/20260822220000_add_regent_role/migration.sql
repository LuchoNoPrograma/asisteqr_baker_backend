INSERT INTO "roles" ("id", "codigo", "nombre")
VALUES (gen_random_uuid(), 'REGENTE', 'Regente')
ON CONFLICT ("codigo") DO UPDATE SET "nombre" = EXCLUDED."nombre";
