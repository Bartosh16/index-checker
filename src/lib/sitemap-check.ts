import { inspectGoogleIndex } from "@/lib/gsc";
import { checkSerpVisibility } from "@/lib/serper";
import { collectSitemapUrls } from "@/lib/sitemap";
import { getIntegerEnv, getOptionalEnv } from "@/lib/env";
import { inferGscPropertyUrl, normalizeDomain } from "@/lib/url";

export type IndexCheckSource = "GSC" | "SERP";
export type IndexStatus = "INDEXED" | "NOT_INDEXED" | "UNKNOWN" | "ERROR";

export type SitemapCheckRow = {
  checkedAt: string;
  detail: string | null;
  error: string | null;
  lastmod: string | null;
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
  domain: string;
  gscPropertyUrl: string | null;
  rows: SitemapCheckRow[];
  sitemapUrl: string;
  source: IndexCheckSource;
  summary: SitemapCheckSummary;
};

export type RunSitemapCheckInput = {
  batchSize?: number;
  domain?: string;
  gscPropertyUrl?: string;
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

  const source = resolveCheckSource();
  const gscPropertyUrl = source === "GSC" ? normalizeGscProperty(input.gscPropertyUrl, domain) : null;
  const urls = await collectSitemapUrls(sitemapUrl, domain);
  const batchSize = normalizeBatchSize(input.batchSize);
  const rows = await mapWithConcurrency(urls, batchSize, async (entry) => {
    if (source === "GSC") {
      const gsc = await inspectGoogleIndex(entry.loc, gscPropertyUrl!);
      return {
        checkedAt: new Date().toISOString(),
        detail: gsc.verdict || gsc.coverageState || gsc.indexingState || null,
        error: gsc.error,
        lastmod: entry.lastmod?.toISOString() ?? null,
        source,
        status: mapGscOutcome(gsc.status),
        url: entry.loc
      } satisfies SitemapCheckRow;
    }

    const serp = await checkSerpVisibility(entry.loc, {
      gl: input.serperGl?.trim() || "pl",
      hl: input.serperHl?.trim() || "pl"
    });

    return {
      checkedAt: new Date().toISOString(),
      detail: serp.matchedUrl || serp.query,
      error: serp.error,
      lastmod: entry.lastmod?.toISOString() ?? null,
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

export function resolveCheckSource(): IndexCheckSource {
  const hasGoogleCredentials = Boolean(
    getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_JSON") || getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_FILE")
  );
  const hasSerperKey = Boolean(getOptionalEnv("SERPER_API_KEY"));

  if (hasGoogleCredentials) {
    return "GSC";
  }
  if (hasSerperKey) {
    return "SERP";
  }

  throw new Error("Configure Google service account credentials or SERPER_API_KEY before running a check.");
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
