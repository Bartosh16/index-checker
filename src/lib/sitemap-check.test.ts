import { describe, expect, it } from "vitest";
import { resolveCheckProvider, resolveSerpQueryStrategy } from "@/lib/sitemap-check";

describe("resolveCheckProvider", () => {
  it("prefers GSC in auto mode when Google credentials are present", () => {
    process.env.CHECK_PROVIDER = "AUTO";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"client_email":"test@example.com"}';
    delete process.env.SERPER_API_KEY;

    expect(resolveCheckProvider()).toBe("GSC");

    delete process.env.CHECK_PROVIDER;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  });

  it("uses the forced SERP provider when it is configured", () => {
    process.env.CHECK_PROVIDER = "SERPAPI";
    process.env.SERPAPI_API_KEY = "test";
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

    expect(resolveCheckProvider()).toBe("SERPAPI");

    delete process.env.CHECK_PROVIDER;
    delete process.env.SERPAPI_API_KEY;
  });
});

describe("resolveSerpQueryStrategy", () => {
  it("defaults to site and raw URL fallback", () => {
    delete process.env.SERP_QUERY_STRATEGY;
    expect(resolveSerpQueryStrategy()).toBe("SITE_THEN_URL");
  });

  it("accepts site only mode", () => {
    process.env.SERP_QUERY_STRATEGY = "SITE_ONLY";
    expect(resolveSerpQueryStrategy()).toBe("SITE_ONLY");
    delete process.env.SERP_QUERY_STRATEGY;
  });
});
