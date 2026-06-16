import { SerpStatus } from "@prisma/client";
import { getOptionalEnv } from "@/lib/env";
import { normalizeUrlForComparison } from "@/lib/url";

type SerperOrganicResult = {
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
  status: SerpStatus;
  visible: boolean;
  query: string;
  matchedUrl: string | null;
  error: string | null;
};

export type SerperCheckOptions = {
  hl: string;
  gl: string;
  apiKey?: string;
};

export async function checkSerpVisibility(url: string, options: SerperCheckOptions): Promise<SerperCheckOutcome> {
  const apiKey = options.apiKey ?? getOptionalEnv("SERPER_API_KEY");
  const query = `site:${url}`;

  if (!apiKey) {
    return {
      status: SerpStatus.SKIPPED,
      visible: false,
      query,
      matchedUrl: null,
      error: "SERPER_API_KEY is not configured."
    };
  }

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey
    },
    body: JSON.stringify({
      q: query,
      hl: options.hl,
      gl: options.gl,
      num: 10
    })
  });

  const body = (await response.json().catch(() => ({}))) as SerperResponse;
  if (!response.ok) {
    return {
      status: SerpStatus.ERROR,
      visible: false,
      query,
      matchedUrl: null,
      error: body.message ?? `Serper request failed with ${response.status}.`
    };
  }

  const matchedUrl = findExactSerpMatch(url, body.organic ?? []);
  return {
    status: matchedUrl ? SerpStatus.VISIBLE : SerpStatus.NOT_VISIBLE,
    visible: Boolean(matchedUrl),
    query,
    matchedUrl,
    error: null
  };
}

export function findExactSerpMatch(targetUrl: string, organicResults: SerperOrganicResult[]): string | null {
  const normalizedTarget = normalizeUrlForComparison(targetUrl);

  for (const result of organicResults) {
    if (!result.link) {
      continue;
    }

    try {
      if (normalizeUrlForComparison(result.link) === normalizedTarget) {
        return result.link;
      }
    } catch {
      continue;
    }
  }

  return null;
}
