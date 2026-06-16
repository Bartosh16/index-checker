import { XMLParser } from "fast-xml-parser";
import { hostBelongsToDomain, isHttpUrl, normalizeUrlForComparison } from "@/lib/url";

export type SitemapEntry = {
  loc: string;
  normalizedUrl: string;
  lastmod: Date | null;
};

type ParsedSitemap =
  | {
      type: "urlset";
      urls: Array<{ loc: string; lastmod: string | null }>;
    }
  | {
      type: "sitemapindex";
      sitemaps: string[];
    };

type FetchLike = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true
});

export function parseSitemapXml(xml: string): ParsedSitemap {
  const parsed = parser.parse(xml) as {
    urlset?: { url?: unknown };
    sitemapindex?: { sitemap?: unknown };
  };

  if (parsed.urlset) {
    const urls = arrayify<{ loc?: string; lastmod?: string }>(parsed.urlset.url)
      .filter((entry) => typeof entry.loc === "string" && entry.loc.trim())
      .map((entry) => ({
        loc: entry.loc!.trim(),
        lastmod: typeof entry.lastmod === "string" ? entry.lastmod : null
      }));

    return { type: "urlset", urls };
  }

  if (parsed.sitemapindex) {
    const sitemaps = arrayify<{ loc?: string }>(parsed.sitemapindex.sitemap)
      .filter((entry) => typeof entry.loc === "string" && entry.loc.trim())
      .map((entry) => entry.loc!.trim());

    return { type: "sitemapindex", sitemaps };
  }

  throw new Error("Unsupported sitemap XML: expected urlset or sitemapindex.");
}

export async function collectSitemapUrls(
  sitemapUrl: string,
  projectDomain: string,
  fetchImpl: FetchLike = fetch,
  visited = new Set<string>(),
  depth = 0
): Promise<SitemapEntry[]> {
  if (depth > 10) {
    throw new Error("Sitemap nesting is deeper than 10 levels.");
  }

  const normalizedSitemapUrl = normalizeUrlForComparison(sitemapUrl);
  if (visited.has(normalizedSitemapUrl)) {
    return [];
  }
  visited.add(normalizedSitemapUrl);

  const response = await fetchImpl(sitemapUrl, {
    headers: {
      Accept: "application/xml,text/xml,*/*",
      "User-Agent": "IndexChecker/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Sitemap request failed with ${response.status} ${response.statusText}.`);
  }

  const parsed = parseSitemapXml(await response.text());
  if (parsed.type === "sitemapindex") {
    const nested = await Promise.all(
      parsed.sitemaps.map((nestedSitemap) =>
        collectSitemapUrls(nestedSitemap, projectDomain, fetchImpl, visited, depth + 1)
      )
    );
    return dedupeEntries(nested.flat());
  }

  return dedupeEntries(
    parsed.urls
      .filter((entry) => isHttpUrl(entry.loc))
      .filter((entry) => hostBelongsToDomain(new URL(entry.loc).hostname, projectDomain))
      .map((entry) => ({
        loc: entry.loc,
        normalizedUrl: normalizeUrlForComparison(entry.loc),
        lastmod: parseLastmod(entry.lastmod)
      }))
  );
}

function parseLastmod(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dedupeEntries(entries: SitemapEntry[]): SitemapEntry[] {
  const seen = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    seen.set(entry.normalizedUrl, entry);
  }
  return [...seen.values()];
}

function arrayify<T>(value: unknown): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? (value as T[]) : [value as T];
}
