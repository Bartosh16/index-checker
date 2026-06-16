import { describe, expect, it } from "vitest";
import { buildSerpQueries } from "@/lib/check-providers";
import { findExactSerpMatch } from "@/lib/serp-utils";

describe("findExactSerpMatch", () => {
  it("matches the exact normalized URL", () => {
    const match = findExactSerpMatch("https://example.com/post/", [
      { link: "https://example.com/post", position: 1 }
    ]);

    expect(match).toBe("https://example.com/post");
  });

  it("does not match similar URLs", () => {
    const match = findExactSerpMatch("https://example.com/post", [
      { link: "https://example.com/post-2", position: 1 },
      { link: "https://example.com/category/post", position: 2 }
    ]);

    expect(match).toBeNull();
  });

  it("builds a raw URL fallback when the strategy asks for it", () => {
    expect(buildSerpQueries("https://example.com/post", "SITE_THEN_URL")).toEqual([
      "site:https://example.com/post",
      "https://example.com/post"
    ]);
  });
});
