type Environment = Record<string, string | undefined>;

export function validateEnvironment(raw: Environment): Environment {
  const required = [
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "QR_TOKEN_SECRET",
    "CORS_ORIGINS",
  ];
  const missing = required.filter((key) => !raw[key]);
  if (missing.length > 0)
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  if (raw.NODE_ENV === "production") {
    for (const key of [
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "QR_TOKEN_SECRET",
    ]) {
      if ((raw[key]?.length ?? 0) < 32)
        throw new Error(`${key} debe tener al menos 32 caracteres`);
    }
  }
  return {
    ...raw,
    PORT: raw.PORT ?? "3000",
    ZONA_HORARIA: raw.ZONA_HORARIA ?? "America/La_Paz",
  };
}
