import {
  ActiveCheckProvider,
  getConfiguredProviders,
  normalizeCheckProvider,
  normalizeSerpQueryStrategy,
  resolveConfiguredProvider,
  SerpCheckOutcome
} from "@/lib/check-providers";
import { checkDataForSeoVisibility } from "@/lib/dataforseo";
import { inspectGoogleIndex } from "@/lib/gsc";
import { checkSearxngVisibility } from "@/lib/searxng";
import { checkSerpApiVisibility } from "@/lib/serpapi";
import { checkSerpVisibility } from "@/lib/serper";
import { collectSitemapUrls } from "@/lib/sitemap";
import { getIntegerEnv, getOptionalEnv } from "@/lib/env";
import { inferGscPropertyUrl, normalizeDomain, normalizeUrlForComparison } from "@/lib/url";

export type IndexCheckSource = ActiveCheckProvider;
export type IndexStatus = "INDEXED" | "NOT_INDEXED" | "UNKNOWN" | "ERROR";

export type SitemapCheckRow = {
  checkedAt: string;
  changedSincePrevious?: boolean;
  detail: string | null;
  error: string | null;
  lastmod: string | null;
  lookup: string | null;
  previousStatus?: IndexStatus | null;
  queryAttempts?: string[];
  source: IndexCheckSource;
  status: IndexStatus;
  url: string;
};

export type SitemapCheckSummary = {
  errors: number;
  indexed: number;
  notIndexed: number;
  total: number;
  unknown: number;
};

export type SitemapCheckResponse = {
  changedCount?: number;
  domain: string;
  gscPropertyUrl: string | null;
  previousRunId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  rows: SitemapCheckRow[];
  runId?: string | null;
  runMode?: "ALL_URLS" | "LAST_NOT_INDEXED" | null;
  sitemapUrl: string;
  source: IndexCheckSource;
  summary: SitemapCheckSummary;
};

export type RunSitemapCheckInput = {
  batchSize?: number;
  domain?: string;
  gscPropertyUrl?: string;
  restrictToUrls?: string[];
  serperGl?: string;
  serperHl?: string;
  sitemapUrl: string;
};

const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 20;

export async function runSitemapCheck(input: RunSitemapCheckInput): Promise<SitemapCheckResponse> {
  const sitemapUrl = input.sitemapUrl.trim();
  const domain = normalizeDomain(input.domain || sitemapUrl);

  if (!sitemapUrl) {
    throw new Error("Sitemap URL is required.");
  }
  if (!domain) {
    throw new Error("Could not infer the domain from the provided sitemap URL.");
  }

  const source = resolveCheckProvider();
  const gscPropertyUrl = source === "GSC" ? normalizeGscProperty(input.gscPropertyUrl, domain) : null;
  const serpQueryStrategy = resolveSerpQueryStrategy();
  const urls = filterEntries(await collectSitemapUrls(sitemapUrl, domain), input.restrictToUrls);
  const batchSize = normalizeBatchSize(input.batchSize);
  const rows = await mapWithConcurrency(urls, batchSize, async (entry) => {
    if (source === "GSC") {
      const gsc = await inspectGoogleIndex(entry.loc, gscPropertyUrl!);
      return {
        checkedAt: new Date().toISOString(),
        detail: buildGscDetail(gsc),
        error: gsc.error,
        lastmod: entry.lastmod?.toISOString() ?? null,
        lookup: buildGscLookup(gsc.status),
        previousStatus: null,
        queryAttempts: [],
        source,
        status: mapGscOutcome(gsc.status),
        url: entry.loc
      } satisfies SitemapCheckRow;
    }

    const serp = await runSerpProvider(source, entry.loc, {
      gl: input.serperGl?.trim() || "pl",
      hl: input.serperHl?.trim() || "pl",
      strategy: serpQueryStrategy
    });

    return {
      checkedAt: new Date().toISOString(),
      detail: buildSerpDetail(serp),
      error: serp.error,
      lastmod: entry.lastmod?.toISOString() ?? null,
      lookup: buildSerpLookup(serp),
      previousStatus: null,
      queryAttempts: serp.queryAttempts,
      source,
      status: mapSerpOutcome(serp.status),
      url: entry.loc
    } satisfies SitemapCheckRow;
  });

  return {
    domain,
    gscPropertyUrl,
    rows,
    sitemapUrl,
    source,
    summary: summarizeRows(rows)
  };
}

export function resolveCheckProvider(): IndexCheckSource {
  const configuredProviders = getConfiguredProviders(process.env);
  const setting = normalizeCheckProvider(getOptionalEnv("CHECK_PROVIDER"));
  const resolved = resolveConfiguredProvider(setting, configuredProviders);

  if (!resolved.provider || resolved.error) {
    throw new Error(resolved.error || "No check provider is configured.");
  }

  return resolved.provider;
}

export const resolveCheckSource = resolveCheckProvider;

export function resolveSerpQueryStrategy() {
  return normalizeSerpQueryStrategy(getOptionalEnv("SERP_QUERY_STRATEGY"));
}

function normalizeGscProperty(value: string | undefined, domain: string): string {
  const inferred = inferGscPropertyUrl(domain);
  const trimmed = value?.trim();
  return trimmed || inferred;
}

function normalizeBatchSize(value: number | undefined): number {
  const fallback = getIntegerEnv("CHECK_BATCH_SIZE", DEFAULT_BATCH_SIZE);
  const parsed = value && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(1, Math.min(parsed, MAX_BATCH_SIZE));
}

function filterEntries(
  entries: Awaited<ReturnType<typeof collectSitemapUrls>>,
  restrictToUrls: string[] | undefined
) {
  if (!restrictToUrls?.length) {
    return entries;
  }

  const allowed = new Set(
    restrictToUrls.map((value) => {
      try {
        return normalizeUrlForComparison(value);
      } catch {
        return value.trim();
      }
    })
  );

  return entries.filter((entry) => allowed.has(entry.normalizedUrl));
}

async function runSerpProvider(
  source: Exclude<IndexCheckSource, "GSC">,
  url: string,
  options: { gl: string; hl: string; strategy: ReturnType<typeof resolveSerpQueryStrategy> }
): Promise<SerpCheckOutcome> {
  if (source === "SERPER") {
    return checkSerpVisibility(url, options);
  }
  if (source === "DATAFORSEO") {
    return checkDataForSeoVisibility(url, options);
  }
  if (source === "SERPAPI") {
    return checkSerpApiVisibility(url, options);
  }
  return checkSearxngVisibility(url, { strategy: options.strategy });
}

function mapGscOutcome(status: string): IndexStatus {
  if (status === "PASS") {
    return "INDEXED";
  }
  if (status === "FAIL") {
    return "NOT_INDEXED";
  }
  if (status === "ERROR") {
    return "ERROR";
  }
  return "UNKNOWN";
}

function mapSerpOutcome(status: string): IndexStatus {
  if (status === "VISIBLE") {
    return "INDEXED";
  }
  if (status === "NOT_VISIBLE") {
    return "NOT_INDEXED";
  }
  if (status === "ERROR") {
    return "ERROR";
  }
  return "UNKNOWN";
}

function buildGscLookup(status: string) {
  if (status === "PASS") {
    return "GSC says indexed";
  }
  if (status === "FAIL") {
    return "GSC says not indexed";
  }
  if (status === "ERROR") {
    return "GSC request error";
  }
  if (status === "SKIPPED") {
    return "GSC skipped";
  }
  return "GSC returned unknown state";
}

function buildGscDetail(gsc: Awaited<ReturnType<typeof inspectGoogleIndex>>) {
  const parts = [gsc.verdict, gsc.coverageState, gsc.indexingState].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

function buildSerpLookup(serp: SerpCheckOutcome) {
  const firstQuery = serp.queryAttempts[0] || "";
  const usedRawFallback = serp.queryAttempts.length > 1 && serp.query === serp.queryAttempts[serp.queryAttempts.length - 1];

  if (serp.status === "VISIBLE") {
    return usedRawFallback ? "Matched on raw URL fallback" : `Matched on ${labelQuery(firstQuery)}`;
  }
  if (serp.status === "NOT_VISIBLE") {
    return usedRawFallback
      ? "Not found after site query and raw URL fallback"
      : `Not found on ${labelQuery(firstQuery)}`;
  }
  if (serp.status === "SKIPPED") {
    return "Provider skipped";
  }
  return "Provider request error";
}

function buildSerpDetail(serp: SerpCheckOutcome) {
  const parts: string[] = [];
  if (serp.matchedUrl) {
    parts.push(`Match: ${serp.matchedUrl}`);
  }
  if (serp.queryAttempts.length) {
    parts.push(`Queries: ${serp.queryAttempts.join(" -> ")}`);
  }
  return parts.length ? parts.join(" | ") : null;
}

function labelQuery(query: string) {
  return query.startsWith("site:") ? "site query" : "raw URL query";
}

function summarizeRows(rows: SitemapCheckRow[]): SitemapCheckSummary {
  return rows.reduce<SitemapCheckSummary>(
    (summary, row) => {
      summary.total += 1;
      if (row.status === "INDEXED") {
        summary.indexed += 1;
      } else if (row.status === "NOT_INDEXED") {
        summary.notIndexed += 1;
      } else if (row.status === "ERROR") {
        summary.errors += 1;
      } else {
        summary.unknown += 1;
      }
      return summary;
    },
    { errors: 0, indexed: 0, notIndexed: 0, total: 0, unknown: 0 }
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
}
