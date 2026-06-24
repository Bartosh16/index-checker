import { buildSerpQueries, SerpCheckOutcome, SerpQueryStrategy } from "@/lib/check-providers";
import { getOptionalEnv } from "@/lib/env";
import { findExactSerpMatch } from "@/lib/serp-utils";

type DataForSeoItem = {
  items?: DataForSeoItem[];
  url?: string;
};

type DataForSeoTask = {
  result?: Array<{
    items?: DataForSeoItem[];
  }>;
  status_message?: string;
};

type DataForSeoResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: DataForSeoTask[];
};

export type DataForSeoCheckOptions = {
  gl: string;
  hl: string;
  languageCode?: string;
  locationCode?: string;
  locationName?: string;
  login?: string;
  password?: string;
  signal?: AbortSignal;
  strategy: SerpQueryStrategy;
};

export async function checkDataForSeoVisibility(
  url: string,
  options: DataForSeoCheckOptions
): Promise<SerpCheckOutcome> {
  const login = options.login ?? getOptionalEnv("DATAFORSEO_LOGIN");
  const password = options.password ?? getOptionalEnv("DATAFORSEO_PASSWORD");
  const locationCode = options.locationCode ?? getOptionalEnv("DATAFORSEO_LOCATION_CODE");
  const locationName = options.locationName ?? getOptionalEnv("DATAFORSEO_LOCATION_NAME");
  const languageCode =
    options.languageCode ?? getOptionalEnv("DATAFORSEO_LANGUAGE_CODE") ?? options.hl.toLowerCase() ?? "pl";
  const queryAttempts = buildSerpQueries(url, options.strategy);

  if (!login || !password) {
    return skipped(queryAttempts, "DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD is not configured.");
  }
  if (!locationCode && !locationName) {
    return skipped(
      queryAttempts,
      "DataForSEO needs DATAFORSEO_LOCATION_CODE or DATAFORSEO_LOCATION_NAME in Settings."
    );
  }

  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  for (const query of queryAttempts) {
    try {
      const numericLocationCode = locationCode ? Number.parseInt(locationCode, 10) : NaN;
      const payload = {
        keyword: query,
        depth: 20,
        language_code: languageCode,
        ...(Number.isFinite(numericLocationCode) ? { location_code: numericLocationCode } : {}),
        ...(!Number.isFinite(numericLocationCode) && locationName ? { location_name: locationName } : {})
      };

      const response = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        signal: options.signal,
        body: JSON.stringify([payload])
      });

      const body = (await response.json().catch(() => ({}))) as DataForSeoResponse;
      const task = body.tasks?.[0];

      if (!response.ok || body.status_code !== 20000 || !task) {
        return {
          provider: "DATAFORSEO",
          status: "ERROR",
          visible: false,
          query,
          queryAttempts,
          matchedUrl: null,
          error:
            task?.status_message ??
            body.status_message ??
            `DataForSEO request failed with ${response.status || "unknown status"}.`
        };
      }

      const matchedUrl = findExactSerpMatch(url, collectItems(task.result?.[0]?.items ?? []));
      if (matchedUrl) {
        return {
          provider: "DATAFORSEO",
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
        provider: "DATAFORSEO",
        status: "ERROR",
        visible: false,
        query,
        queryAttempts,
        matchedUrl: null,
        error: error instanceof Error ? error.message : "DataForSEO request failed."
      };
    }
  }

  return {
    provider: "DATAFORSEO",
    status: "NOT_VISIBLE",
    visible: false,
    query: queryAttempts[queryAttempts.length - 1]!,
    queryAttempts,
    matchedUrl: null,
    error: null
  };
}

function collectItems(items: DataForSeoItem[]): Array<{ url?: string }> {
  const flattened: Array<{ url?: string }> = [];

  for (const item of items) {
    if (item.url) {
      flattened.push({ url: item.url });
    }
    if (item.items?.length) {
      flattened.push(...collectItems(item.items));
    }
  }

  return flattened;
}

function skipped(queryAttempts: string[], error: string): SerpCheckOutcome {
  return {
    provider: "DATAFORSEO",
    status: "SKIPPED",
    visible: false,
    query: queryAttempts[0]!,
    queryAttempts,
    matchedUrl: null,
    error
  };
}
