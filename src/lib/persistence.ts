export type ProjectStoreDriver = "local" | "postgres";

export function resolveProjectStoreDriver(): ProjectStoreDriver {
  const configured = (process.env.PERSISTENCE_DRIVER || "").trim().toLowerCase();
  if (configured === "postgres" && process.env.DATABASE_URL?.trim()) {
    return "postgres";
  }
  return "local";
}

export function isHostedPersistenceEnabled() {
  return resolveProjectStoreDriver() === "postgres";
}
