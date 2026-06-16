import { buildSerpQueries, SerpCheckOutcome, SerpQueryStrategy } from "@/lib/check-providers";
import { getOptionalEnv } from "@/lib/env";
import { findExactSerpMatch } from "@/lib/serp-utils";

type SerpApiResponse = {
  error?: string;
  organic_results?: Array<{
    link?: string;
  }>;
};

export type SerpApiCheckOptions = {
  apiKey?: string;
  gl: string;
  hl: string;
  strategy: SerpQueryStrategy;
};

export async function checkSerpApiVisibility(url: string, options: SerpApiCheckOptions): Promise<SerpCheckOutcome> {
  const apiKey = options.apiKey ?? getOptionalEnv("SERPAPI_API_KEY");
  const queryAttempts = buildSerpQueries(url, options.strategy);

  if (!apiKey) {
    return {
      provider: "SERPAPI",
      status: "SKIPPED",
      visible: false,
      query: queryAttempts[0]!,
      queryAttempts,
      matchedUrl: null,
      error: "SERPAPI_API_KEY is not configured."
    };
  }

  for (const query of queryAttempts) {
    try {
      const endpoint = new URL("https://serpapi.com/search");
      endpoint.searchParams.set("engine", "google");
      endpoint.searchParams.set("output", "json");
      endpoint.searchParams.set("q", query);
      endpoint.searchParams.set("hl", options.hl);
      endpoint.searchParams.set("gl", options.gl);
      endpoint.searchParams.set("num", "10");
      endpoint.searchParams.set("api_key", apiKey);

      const response = await fetch(endpoint);
      const body = (await response.json().catch(() => ({}))) as SerpApiResponse;

      if (!response.ok || body.error) {
        return {
          provider: "SERPAPI",
          status: "ERROR",
          visible: false,
          query,
          queryAttempts,
          matchedUrl: null,
          error: body.error ?? `SerpApi request failed with ${response.status}.`
        };
      }

      const matchedUrl = findExactSerpMatch(url, body.organic_results ?? []);
      if (matchedUrl) {
        return {
          provider: "SERPAPI",
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
        provider: "SERPAPI",
        status: "ERROR",
        visible: false,
        query,
        queryAttempts,
        matchedUrl: null,
        error: error instanceof Error ? error.message : "SerpApi request failed."
      };
    }
  }

  return {
    provider: "SERPAPI",
    status: "NOT_VISIBLE",
    visible: false,
    query: queryAttempts[queryAttempts.length - 1]!,
    queryAttempts,
    matchedUrl: null,
    error: null
  };
}
