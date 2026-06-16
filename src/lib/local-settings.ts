import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ActiveCheckProvider,
  CheckProviderSetting,
  getConfiguredProviders,
  normalizeCheckProvider,
  normalizeSerpQueryStrategy,
  resolveConfiguredProvider,
  SerpQueryStrategy
} from "@/lib/check-providers";

const ENV_PATH = resolve(process.cwd(), ".env");
const MANAGED_KEYS = [
  "DATABASE_URL",
  "CHECK_PROVIDER",
  "SERP_QUERY_STRATEGY",
  "SERPER_API_KEY",
  "SERPAPI_API_KEY",
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "DATAFORSEO_LOCATION_CODE",
  "DATAFORSEO_LOCATION_NAME",
  "DATAFORSEO_LANGUAGE_CODE",
  "SEARXNG_BASE_URL",
  "SEARXNG_ENGINES",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_SERVICE_ACCOUNT_FILE",
  "GSC_LANGUAGE_CODE",
  "CHECK_BATCH_SIZE",
  "CHECK_CACHE_DAYS"
] as const;

type SettingsRecord = Record<string, string>;

export type LocalSettings = {
  checkProvider: CheckProviderSetting;
  configuredProviders: ActiveCheckProvider[];
  dataForSeoLanguageCode: string;
  dataForSeoLocationCode: string;
  dataForSeoLocationName: string;
  dataForSeoLoginHint: string | null;
  googleServiceAccountFile: string;
  gscLanguageCode: string;
  hasDataForSeoCredentials: boolean;
  hasGoogleServiceAccountFile: boolean;
  hasGoogleServiceAccountJson: boolean;
  hasSearxngBaseUrl: boolean;
  hasSerpApiKey: boolean;
  hasSerperApiKey: boolean;
  resolvedProvider: ActiveCheckProvider | null;
  resolvedProviderError: string | null;
  searxngBaseUrl: string;
  searxngEngines: string;
  serpApiKeyHint: string | null;
  serpQueryStrategy: SerpQueryStrategy;
  serperApiKeyHint: string | null;
};

export type SaveLocalSettingsInput = {
  checkProvider?: string;
  clearDataForSeoCredentials?: boolean;
  clearGoogleServiceAccountJson?: boolean;
  clearSerpApiKey?: boolean;
  clearSerperApiKey?: boolean;
  dataForSeoLanguageCode?: string;
  dataForSeoLocationCode?: string;
  dataForSeoLocationName?: string;
  dataForSeoLogin?: string;
  dataForSeoPassword?: string;
  googleServiceAccountFile?: string;
  googleServiceAccountJson?: string;
  gscLanguageCode?: string;
  searxngBaseUrl?: string;
  searxngEngines?: string;
  serpApiKey?: string;
  serpQueryStrategy?: string;
  serperApiKey?: string;
};

export function readLocalSettings(): LocalSettings {
  const values = readResolvedEnv();
  const serperApiKey = values.SERPER_API_KEY ?? "";
  const serpApiKey = values.SERPAPI_API_KEY ?? "";
  const googleServiceAccountJson = values.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  const googleServiceAccountFile = values.GOOGLE_SERVICE_ACCOUNT_FILE ?? "";
  const dataForSeoLogin = values.DATAFORSEO_LOGIN ?? "";
  const dataForSeoPassword = values.DATAFORSEO_PASSWORD ?? "";
  const configuredProviders = getConfiguredProviders(values);
  const checkProvider = normalizeCheckProvider(values.CHECK_PROVIDER);
  const resolved = resolveConfiguredProvider(checkProvider, configuredProviders);

  return {
    checkProvider,
    configuredProviders,
    dataForSeoLanguageCode: values.DATAFORSEO_LANGUAGE_CODE ?? "pl",
    dataForSeoLocationCode: values.DATAFORSEO_LOCATION_CODE ?? "",
    dataForSeoLocationName: values.DATAFORSEO_LOCATION_NAME ?? "",
    dataForSeoLoginHint: dataForSeoLogin.trim() ? maskSecret(dataForSeoLogin) : null,
    googleServiceAccountFile,
    gscLanguageCode: values.GSC_LANGUAGE_CODE ?? "pl-PL",
    hasDataForSeoCredentials: Boolean(
      dataForSeoLogin.trim() &&
        dataForSeoPassword.trim() &&
        ((values.DATAFORSEO_LOCATION_CODE ?? "").trim() || (values.DATAFORSEO_LOCATION_NAME ?? "").trim())
    ),
    hasGoogleServiceAccountFile: Boolean(googleServiceAccountFile.trim()),
    hasGoogleServiceAccountJson: Boolean(googleServiceAccountJson.trim()),
    hasSearxngBaseUrl: Boolean((values.SEARXNG_BASE_URL ?? "").trim()),
    hasSerpApiKey: Boolean(serpApiKey.trim()),
    hasSerperApiKey: Boolean(serperApiKey.trim()),
    resolvedProvider: resolved.provider,
    resolvedProviderError: resolved.error,
    searxngBaseUrl: values.SEARXNG_BASE_URL ?? "",
    searxngEngines: values.SEARXNG_ENGINES ?? "",
    serpApiKeyHint: serpApiKey.trim() ? maskSecret(serpApiKey) : null,
    serpQueryStrategy: normalizeSerpQueryStrategy(values.SERP_QUERY_STRATEGY),
    serperApiKeyHint: serperApiKey.trim() ? maskSecret(serperApiKey) : null
  };
}

export function saveLocalSettings(input: SaveLocalSettingsInput): LocalSettings {
  const nextEnv: SettingsRecord = { ...readEnvFile() };

  if (input.checkProvider !== undefined) {
    setEnvValue(nextEnv, "CHECK_PROVIDER", normalizeCheckProvider(input.checkProvider));
  }
  if (input.serpQueryStrategy !== undefined) {
    setEnvValue(nextEnv, "SERP_QUERY_STRATEGY", normalizeSerpQueryStrategy(input.serpQueryStrategy));
  }

  if (input.serperApiKey !== undefined) {
    setEnvValue(nextEnv, "SERPER_API_KEY", input.serperApiKey.trim());
  }
  if (input.clearSerperApiKey) {
    setEnvValue(nextEnv, "SERPER_API_KEY", "");
  }

  if (input.serpApiKey !== undefined) {
    setEnvValue(nextEnv, "SERPAPI_API_KEY", input.serpApiKey.trim());
  }
  if (input.clearSerpApiKey) {
    setEnvValue(nextEnv, "SERPAPI_API_KEY", "");
  }

  if (input.dataForSeoLogin !== undefined) {
    setEnvValue(nextEnv, "DATAFORSEO_LOGIN", input.dataForSeoLogin.trim());
  }
  if (input.dataForSeoPassword !== undefined) {
    setEnvValue(nextEnv, "DATAFORSEO_PASSWORD", input.dataForSeoPassword.trim());
  }
  if (input.clearDataForSeoCredentials) {
    setEnvValue(nextEnv, "DATAFORSEO_LOGIN", "");
    setEnvValue(nextEnv, "DATAFORSEO_PASSWORD", "");
  }
  if (input.dataForSeoLocationCode !== undefined) {
    setEnvValue(nextEnv, "DATAFORSEO_LOCATION_CODE", input.dataForSeoLocationCode.trim());
  }
  if (input.dataForSeoLocationName !== undefined) {
    setEnvValue(nextEnv, "DATAFORSEO_LOCATION_NAME", input.dataForSeoLocationName.trim());
  }
  if (input.dataForSeoLanguageCode !== undefined) {
    setEnvValue(nextEnv, "DATAFORSEO_LANGUAGE_CODE", input.dataForSeoLanguageCode.trim() || "pl");
  }

  if (input.googleServiceAccountJson !== undefined) {
    const normalizedJson = input.googleServiceAccountJson.trim();
    if (normalizedJson) {
      JSON.parse(normalizedJson);
    }
    setEnvValue(nextEnv, "GOOGLE_SERVICE_ACCOUNT_JSON", normalizedJson);
  }
  if (input.clearGoogleServiceAccountJson) {
    setEnvValue(nextEnv, "GOOGLE_SERVICE_ACCOUNT_JSON", "");
  }

  if (input.googleServiceAccountFile !== undefined) {
    setEnvValue(nextEnv, "GOOGLE_SERVICE_ACCOUNT_FILE", input.googleServiceAccountFile.trim());
  }
  if (input.gscLanguageCode !== undefined) {
    setEnvValue(nextEnv, "GSC_LANGUAGE_CODE", input.gscLanguageCode.trim() || "pl-PL");
  }

  if (input.searxngBaseUrl !== undefined) {
    setEnvValue(nextEnv, "SEARXNG_BASE_URL", input.searxngBaseUrl.trim());
  }
  if (input.searxngEngines !== undefined) {
    setEnvValue(nextEnv, "SEARXNG_ENGINES", input.searxngEngines.trim());
  }

  writeEnvFile(nextEnv);
  return readLocalSettings();
}

function readResolvedEnv(): SettingsRecord {
  return {
    ...readEnvFile(),
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    )
  };
}

function readEnvFile(): SettingsRecord {
  if (!existsSync(ENV_PATH)) {
    return {};
  }

  const content = readFileSync(ENV_PATH, "utf8");
  const env: SettingsRecord = {};

  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    if (!match) {
      continue;
    }

    env[match[1]!] = unquote((match[2] ?? "").trim());
  }

  return env;
}

function writeEnvFile(values: SettingsRecord) {
  const existingLines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8").split(/\r?\n/u) : [];
  const preservedLines = existingLines.filter((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/u);
    return !match || !MANAGED_KEYS.includes(match[1] as (typeof MANAGED_KEYS)[number]);
  });

  const managedLines = [
    `DATABASE_URL=${quote(values.DATABASE_URL ?? process.env.DATABASE_URL ?? "")}`,
    "",
    "# Core checker settings",
    `CHECK_PROVIDER=${quote(values.CHECK_PROVIDER ?? "AUTO")}`,
    `SERP_QUERY_STRATEGY=${quote(values.SERP_QUERY_STRATEGY ?? "SITE_THEN_URL")}`,
    "",
    "# Managed SERP providers",
    `SERPER_API_KEY=${quote(values.SERPER_API_KEY ?? "")}`,
    `SERPAPI_API_KEY=${quote(values.SERPAPI_API_KEY ?? "")}`,
    `DATAFORSEO_LOGIN=${quote(values.DATAFORSEO_LOGIN ?? "")}`,
    `DATAFORSEO_PASSWORD=${quote(values.DATAFORSEO_PASSWORD ?? "")}`,
    `DATAFORSEO_LOCATION_CODE=${quote(values.DATAFORSEO_LOCATION_CODE ?? "")}`,
    `DATAFORSEO_LOCATION_NAME=${quote(values.DATAFORSEO_LOCATION_NAME ?? "")}`,
    `DATAFORSEO_LANGUAGE_CODE=${quote(values.DATAFORSEO_LANGUAGE_CODE ?? "pl")}`,
    `SEARXNG_BASE_URL=${quote(values.SEARXNG_BASE_URL ?? "")}`,
    `SEARXNG_ENGINES=${quote(values.SEARXNG_ENGINES ?? "")}`,
    "",
    "# Google Search Console",
    `GOOGLE_SERVICE_ACCOUNT_JSON=${quote(values.GOOGLE_SERVICE_ACCOUNT_JSON ?? "")}`,
    `GOOGLE_SERVICE_ACCOUNT_FILE=${quote(values.GOOGLE_SERVICE_ACCOUNT_FILE ?? "")}`,
    `GSC_LANGUAGE_CODE=${quote(values.GSC_LANGUAGE_CODE ?? "pl-PL")}`,
    "",
    "# Runtime tuning",
    `CHECK_BATCH_SIZE=${quote(values.CHECK_BATCH_SIZE ?? process.env.CHECK_BATCH_SIZE ?? "25")}`,
    `CHECK_CACHE_DAYS=${quote(values.CHECK_CACHE_DAYS ?? process.env.CHECK_CACHE_DAYS ?? "7")}`
  ];

  const allLines = [...managedLines];
  if (preservedLines.some((line) => line.trim().length > 0)) {
    allLines.push("", "# Unmanaged entries preserved from your existing .env", ...preservedLines);
  }

  writeFileSync(ENV_PATH, `${allLines.join("\n")}\n`, "utf8");
}

function setEnvValue(target: SettingsRecord, key: string, value: string) {
  target[key] = value;
  process.env[key] = value;
}

function quote(value: string) {
  return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

function unquote(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/gu, '"').replace(/\\\\/gu, "\\");
  }
  return trimmed;
}

function maskSecret(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 6) {
    return "Configured";
  }
  return `${trimmed.slice(0, 3)}...${trimmed.slice(-4)}`;
}
