import { describe, expect, it } from "vitest";
import { collectSitemapUrls, parseSitemapXml } from "@/lib/sitemap";

describe("parseSitemapXml", () => {
  it("reads URL entries from urlset", () => {
    const parsed = parseSitemapXml(`<?xml version="1.0"?>
      <urlset>
        <url>
          <loc>https://example.com/a</loc>
          <lastmod>2026-01-02</lastmod>
        </url>
      </urlset>`);

    expect(parsed).toEqual({
      type: "urlset",
      urls: [{ loc: "https://example.com/a", lastmod: "2026-01-02" }]
    });
  });

  it("reads nested sitemap URLs from sitemapindex", () => {
    const parsed = parseSitemapXml(`<?xml version="1.0"?>
      <sitemapindex>
        <sitemap><loc>https://example.com/posts.xml</loc></sitemap>
      </sitemapindex>`);

    expect(parsed).toEqual({
      type: "sitemapindex",
      sitemaps: ["https://example.com/posts.xml"]
    });
  });
});

describe("collectSitemapUrls", () => {
  it("deduplicates URLs and ignores URLs outside the project domain", async () => {
    const responses = new Map([
      [
        "https://example.com/sitemap.xml",
        `<sitemapindex>
          <sitemap><loc>https://example.com/posts.xml</loc></sitemap>
        </sitemapindex>`
      ],
      [
        "https://example.com/posts.xml",
        `<urlset>
          <url><loc>https://example.com/post/</loc></url>
          <url><loc>https://example.com/post</loc></url>
          <url><loc>https://other.test/post</loc></url>
        </urlset>`
      ]
    ]);

    const fetchImpl = async (url: string) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => responses.get(url) ?? ""
    });

    const urls = await collectSitemapUrls("https://example.com/sitemap.xml", "example.com", fetchImpl);

    expect(urls).toHaveLength(1);
    expect(urls[0]?.normalizedUrl).toBe("https://example.com/post");
  });
});
