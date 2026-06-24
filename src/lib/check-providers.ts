export const CHECK_PROVIDER_VALUES = ["AUTO", "GSC", "SERPER", "DATAFORSEO", "SERPAPI", "SEARXNG"] as const;
export const SERP_QUERY_STRATEGY_VALUES = ["SITE_ONLY", "SITE_THEN_URL"] as const;
export const GSC_STATUS_VALUES = ["PASS", "FAIL", "UNKNOWN", "SKIPPED", "ERROR"] as const;
export const SERP_STATUS_VALUES = ["VISIBLE", "NOT_VISIBLE", "SKIPPED", "ERROR"] as const;

export type CheckProviderSetting = (typeof CHECK_PROVIDER_VALUES)[number];
export type ActiveCheckProvider = Exclude<CheckProviderSetting, "AUTO">;
export type SerpProvider = Exclude<ActiveCheckProvider, "GSC">;
export type SerpQueryStrategy = (typeof SERP_QUERY_STRATEGY_VALUES)[number];
export type GscCheckStatus = (typeof GSC_STATUS_VALUES)[number];
export type SerpCheckStatus = (typeof SERP_STATUS_VALUES)[number];

type ProviderEnvValues = Record<string, string | undefined>;

export type SerpCheckOutcome = {
  error: string | null;
  matchedUrl: string | null;
  provider: SerpProvider;
  query: string;
  queryAttempts: string[];
  status: SerpCheckStatus;
  visible: boolean;
};

export const PROVIDER_LABELS: Record<CheckProviderSetting, string> = {
  AUTO: "Auto",
  DATAFORSEO: "DataForSEO",
  GSC: "Google Search Console",
  SEARXNG: "SearXNG",
  SERPAPI: "SerpApi",
  SERPER: "Serper"
};

export const SERP_QUERY_STRATEGY_LABELS: Record<SerpQueryStrategy, string> = {
  SITE_ONLY: "site:<url> only",
  SITE_THEN_URL: "site:<url> then raw URL"
};

export function normalizeCheckProvider(value: string | undefined): CheckProviderSetting {
  return isCheckProvider(value) ? value : "AUTO";
}

export function normalizeSerpQueryStrategy(value: string | undefined): SerpQueryStrategy {
  return isSerpQueryStrategy(value) ? value : "SITE_THEN_URL";
}

export function getConfiguredProviders(values: ProviderEnvValues): ActiveCheckProvider[] {
  const providers: ActiveCheckProvider[] = [];

  if (hasValue(values, "GOOGLE_SERVICE_ACCOUNT_JSON") || hasValue(values, "GOOGLE_SERVICE_ACCOUNT_FILE")) {
    providers.push("GSC");
  }
  if (hasValue(values, "SERPER_API_KEY")) {
    providers.push("SERPER");
  }
  if (
    hasValue(values, "DATAFORSEO_LOGIN") &&
    hasValue(values, "DATAFORSEO_PASSWORD") &&
    (hasValue(values, "DATAFORSEO_LOCATION_CODE") || hasValue(values, "DATAFORSEO_LOCATION_NAME"))
  ) {
    providers.push("DATAFORSEO");
  }
  if (hasValue(values, "SERPAPI_API_KEY")) {
    providers.push("SERPAPI");
  }
  if (hasValue(values, "SEARXNG_BASE_URL")) {
    providers.push("SEARXNG");
  }

  return providers;
}

export function resolveConfiguredProvider(
  setting: CheckProviderSetting,
  configuredProviders: ActiveCheckProvider[]
): { error: string | null; provider: ActiveCheckProvider | null } {
  if (setting === "AUTO") {
    if (configuredProviders[0]) {
      return { error: null, provider: configuredProviders[0] };
    }

    return {
      error:
        "Configure Google Search Console or at least one SERP provider in Settings before running a check.",
      provider: null
    };
  }

  if (configuredProviders.includes(setting)) {
    return { error: null, provider: setting };
  }

  return {
    error: `${PROVIDER_LABELS[setting]} is selected in Settings but is not fully configured yet.`,
    provider: null
  };
}

export function buildSerpQueries(url: string, strategy: SerpQueryStrategy): string[] {
  const siteQueries = uniqueValues([`site:${url}`, buildSiteQueryWithoutProtocol(url)]);
  if (strategy === "SITE_ONLY") {
    return siteQueries;
  }

  return uniqueValues([...siteQueries, url]);
}

function buildSiteQueryWithoutProtocol(input: string) {
  try {
    const url = new URL(input);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/u, "");
    return `site:${url.hostname}${path}${url.search}`;
  } catch {
    return `site:${input.replace(/^https?:\/\//iu, "")}`;
  }
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function hasValue(values: ProviderEnvValues, key: string) {
  const value = values[key];
  return typeof value === "string" && value.trim().length > 0;
}

function isCheckProvider(value: string | undefined): value is CheckProviderSetting {
  return CHECK_PROVIDER_VALUES.includes((value || "").trim().toUpperCase() as CheckProviderSetting);
}

function isSerpQueryStrategy(value: string | undefined): value is SerpQueryStrategy {
  return SERP_QUERY_STRATEGY_VALUES.includes((value || "").trim().toUpperCase() as SerpQueryStrategy);
}
