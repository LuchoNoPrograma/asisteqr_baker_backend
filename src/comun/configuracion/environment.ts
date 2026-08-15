type Environment = Record<string, string | undefined>;

export function validateEnvironment(raw: Environment): Environment {
  const required = ["DATABASE_URL"];
  const missing = required.filter((key) => !raw[key]);
  if (missing.length > 0)
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  const sessionTtlHours = raw.SESSION_TTL_HOURS ?? "720";
  if (!/^\d+$/.test(sessionTtlHours) || Number(sessionTtlHours) < 1)
    throw new Error("SESSION_TTL_HOURS debe ser un entero positivo");
  return {
    ...raw,
    PORT: raw.PORT ?? "3000",
    SESSION_TTL_HOURS: sessionTtlHours,
    ZONA_HORARIA: raw.ZONA_HORARIA ?? "America/La_Paz",
  };
}
