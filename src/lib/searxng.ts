import { buildSerpQueries, SerpCheckOutcome, SerpQueryStrategy } from "@/lib/check-providers";
import { getOptionalEnv } from "@/lib/env";
import { findExactSerpMatch } from "@/lib/serp-utils";

type SearxngResponse = {
  error?: string;
  results?: Array<{
    url?: string;
  }>;
};

export type SearxngCheckOptions = {
  baseUrl?: string;
  engines?: string;
  signal?: AbortSignal;
  strategy: SerpQueryStrategy;
};

export async function checkSearxngVisibility(url: string, options: SearxngCheckOptions): Promise<SerpCheckOutcome> {
  const baseUrl = options.baseUrl ?? getOptionalEnv("SEARXNG_BASE_URL");
  const engines = options.engines ?? getOptionalEnv("SEARXNG_ENGINES");
  const queryAttempts = buildSerpQueries(url, options.strategy);

  if (!baseUrl) {
    return {
      provider: "SEARXNG",
      status: "SKIPPED",
      visible: false,
      query: queryAttempts[0]!,
      queryAttempts,
      matchedUrl: null,
      error: "SEARXNG_BASE_URL is not configured."
    };
  }

  for (const query of queryAttempts) {
    try {
      const endpoint = normalizeSearxngEndpoint(baseUrl);
      endpoint.searchParams.set("q", query);
      endpoint.searchParams.set("format", "json");
      if (engines) {
        endpoint.searchParams.set("engines", engines);
      }

      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json"
        },
        signal: options.signal
      });
      const body = (await response.json().catch(() => ({}))) as SearxngResponse;

      if (!response.ok) {
        return {
          provider: "SEARXNG",
          status: "ERROR",
          visible: false,
          query,
          queryAttempts,
          matchedUrl: null,
          error: body.error ?? `SearXNG request failed with ${response.status}.`
        };
      }

      const matchedUrl = findExactSerpMatch(url, body.results ?? []);
      if (matchedUrl) {
        return {
          provider: "SEARXNG",
          status: "VISIBLE",
          visible: true,
          query,
          queryAttempts,
          matchedUrl,
          error: null
        };
      }
    } catch (error) {
      return {
        provider: "SEARXNG",
        status: "ERROR",
        visible: false,
        query,
        queryAttempts,
        matchedUrl: null,
        error: error instanceof Error ? error.message : "SearXNG request failed."
      };
    }
  }

  return {
    provider: "SEARXNG",
    status: "NOT_VISIBLE",
    visible: false,
    query: queryAttempts[queryAttempts.length - 1]!,
    queryAttempts,
    matchedUrl: null,
    error: null
  };
}

function normalizeSearxngEndpoint(baseUrl: string): URL {
  const endpoint = new URL(baseUrl);
  endpoint.hash = "";
  endpoint.search = "";

  if (endpoint.pathname === "/" || endpoint.pathname === "") {
    endpoint.pathname = "/search";
  }

  return endpoint;
}
