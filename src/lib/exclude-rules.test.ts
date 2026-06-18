import { describe, expect, it } from "vitest";
import { filterExcludedUrls, matchesExcludeRule, parseExcludeRulesText } from "@/lib/exclude-rules";

describe("parseExcludeRulesText", () => {
  it("keeps only non-empty non-comment lines", () => {
    expect(
      parseExcludeRulesText(`
        # comment
        https://example.com/tag/*

        https://example.com/privacy/
      `)
    ).toEqual(["https://example.com/tag/*", "https://example.com/privacy/"]);
  });
});

describe("matchesExcludeRule", () => {
  it("matches an exact normalized URL", () => {
    expect(matchesExcludeRule("https://example.com/post/", "https://example.com/post")).toBe(true);
  });

  it("matches a prefix rule with trailing wildcard", () => {
    expect(matchesExcludeRule("https://example.com/tag/seo/post-1/", "https://example.com/tag/*")).toBe(true);
  });

  it("does not match unrelated URLs", () => {
    expect(matchesExcludeRule("https://example.com/blog/post-1/", "https://example.com/tag/*")).toBe(false);
  });
});

describe("filterExcludedUrls", () => {
  it("counts and removes excluded items", () => {
    const result = filterExcludedUrls(
      [
        { loc: "https://example.com/tag/seo/" },
        { loc: "https://example.com/post-1/" },
        { loc: "https://example.com/post-2/" }
      ],
      ["https://example.com/tag/*", "https://example.com/post-2/"]
    );

    expect(result.excludedCount).toBe(2);
    expect(result.items).toEqual([{ loc: "https://example.com/post-1/" }]);
  });
});
