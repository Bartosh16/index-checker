import { afterEach, describe, expect, it } from "vitest";
import { resolveProjectStoreDriver } from "@/lib/persistence";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDriver = process.env.PERSISTENCE_DRIVER;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  if (originalDriver === undefined) {
    delete process.env.PERSISTENCE_DRIVER;
  } else {
    process.env.PERSISTENCE_DRIVER = originalDriver;
  }
});

describe("resolveProjectStoreDriver", () => {
  it("defaults to local", () => {
    delete process.env.PERSISTENCE_DRIVER;
    delete process.env.DATABASE_URL;

    expect(resolveProjectStoreDriver()).toBe("local");
  });

  it("uses postgres only when explicitly enabled and DATABASE_URL exists", () => {
    process.env.PERSISTENCE_DRIVER = "postgres";
    process.env.DATABASE_URL = "postgresql://demo:demo@localhost:5432/demo";

    expect(resolveProjectStoreDriver()).toBe("postgres");
  });

  it("falls back to local when the database driver is requested without DATABASE_URL", () => {
    process.env.PERSISTENCE_DRIVER = "postgres";
    delete process.env.DATABASE_URL;

    expect(resolveProjectStoreDriver()).toBe("local");
  });
});
