import { buildSerpQueries, SerpCheckOutcome, SerpQueryStrategy } from "@/lib/check-providers";
import { getOptionalEnv } from "@/lib/env";
import { findExactSerpMatch } from "@/lib/serp-utils";

type SerperOrganicResult = {
  sitelinks?: Array<{ link?: string }>;
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
  message?: string;
};

export type SerperCheckOutcome = {
  provider: "SERPER";
} & SerpCheckOutcome;

export type SerperCheckOptions = {
  apiKey?: string;
  gl: string;
  hl: string;
  signal?: AbortSignal;
  strategy: SerpQueryStrategy;
};

export async function checkSerpVisibility(url: string, options: SerperCheckOptions): Promise<SerperCheckOutcome> {
  const apiKey = options.apiKey ?? getOptionalEnv("SERPER_API_KEY");
  const queryAttempts = buildSerpQueries(url, options.strategy);

  if (!apiKey) {
    return {
      provider: "SERPER",
      status: "SKIPPED",
      visible: false,
      query: queryAttempts[0]!,
      queryAttempts,
      matchedUrl: null,
      error: "SERPER_API_KEY is not configured."
    };
  }

  let retryableError: string | null = null;
  for (const query of queryAttempts) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey
        },
        signal: options.signal,
        body: JSON.stringify({
          q: query,
          hl: options.hl,
          gl: options.gl,
          num: 20
        })
      });

      const body = (await response.json().catch(() => ({}))) as SerperResponse;
      if (!response.ok) {
        const error = body.message ?? `Serper request failed with ${response.status}.`;
        if (isRetryableQueryError(error) && query !== queryAttempts[queryAttempts.length - 1]) {
          retryableError = error;
          continue;
        }

        return {
          provider: "SERPER",
          status: "ERROR",
          visible: false,
          query,
          queryAttempts,
          matchedUrl: null,
          error
        };
      }

      const matchedUrl = findExactSerpMatch(url, body.organic ?? []);
      if (matchedUrl) {
        return {
          provider: "SERPER",
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
        provider: "SERPER",
        status: "ERROR",
        visible: false,
        query,
        queryAttempts,
        matchedUrl: null,
        error: error instanceof Error ? error.message : "Serper request failed."
      };
    }
  }

  if (retryableError && queryAttempts.length === 1) {
    return {
      provider: "SERPER",
      status: "ERROR",
      visible: false,
      query: queryAttempts[0]!,
      queryAttempts,
      matchedUrl: null,
      error: retryableError
    };
  }

  return {
    provider: "SERPER",
    status: "NOT_VISIBLE",
    visible: false,
    query: queryAttempts[queryAttempts.length - 1]!,
    queryAttempts,
    matchedUrl: null,
    error: null
  };
}

function isRetryableQueryError(message: string) {
  return /query pattern not allowed/iu.test(message);
}
