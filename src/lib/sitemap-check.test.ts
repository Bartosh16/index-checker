import { describe, expect, it } from "vitest";
import { resolveCheckSource } from "@/lib/sitemap-check";

describe("resolveCheckSource", () => {
  it("prefers GSC when Google credentials are present", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"client_email":"test@example.com"}';
    delete process.env.SERPER_API_KEY;

    expect(resolveCheckSource()).toBe("GSC");

    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  });

  it("falls back to SERP when only Serper is configured", () => {
    process.env.SERPER_API_KEY = "test";
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

    expect(resolveCheckSource()).toBe("SERP");

    delete process.env.SERPER_API_KEY;
  });
});
