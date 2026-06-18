import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type ActiveCheckProvider,
  type CheckProviderSetting,
  type SerpQueryStrategy,
  getConfiguredProviders,
  normalizeCheckProvider,
  normalizeSerpQueryStrategy,
  resolveConfiguredProvider
} from "@/lib/check-providers";
import { readMailSettingsSnapshot } from "@/lib/mailer";

const ENV_PATH = resolve(process.cwd(), ".env");
const ENV_LOCAL_PATH = resolve(process.cwd(), ".env.local");
const MANAGED_KEYS = [
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
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "MAIL_FROM",
  "DEFAULT_NOTIFICATION_EMAIL",
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
  defaultNotificationEmail: string;
  googleServiceAccountFile: string;
  gscLanguageCode: string;
  hasDataForSeoCredentials: boolean;
  hasGoogleServiceAccountFile: boolean;
  hasGoogleServiceAccountJson: boolean;
  hasSearxngBaseUrl: boolean;
  hasSerpApiKey: boolean;
  hasSerperApiKey: boolean;
  hasSmtpConfig: boolean;
  resolvedProvider: ActiveCheckProvider | null;
  resolvedProviderError: string | null;
  savedToEnvLocal: boolean;
  searxngBaseUrl: string;
  searxngEngines: string;
  serpApiKeyHint: string | null;
  serpQueryStrategy: SerpQueryStrategy;
  serperApiKeyHint: string | null;
  smtpFromEmail: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUserHint: string | null;
};

export type SaveLocalSettingsInput = {
  checkProvider?: string;
  clearDataForSeoCredentials?: boolean;
  clearGoogleServiceAccountJson?: boolean;
  clearSerpApiKey?: boolean;
  clearSerperApiKey?: boolean;
  clearSmtpPassword?: boolean;
  dataForSeoLanguageCode?: string;
  dataForSeoLocationCode?: string;
  dataForSeoLocationName?: string;
  dataForSeoLogin?: string;
  dataForSeoPassword?: string;
  defaultNotificationEmail?: string;
  googleServiceAccountFile?: string;
  googleServiceAccountJson?: string;
  gscLanguageCode?: string;
  searxngBaseUrl?: string;
  searxngEngines?: string;
  serpApiKey?: string;
  serpQueryStrategy?: string;
  serperApiKey?: string;
  smtpFromEmail?: string;
  smtpHost?: string;
  smtpPassword?: string;
  smtpPort?: string;
  smtpSecure?: boolean;
  smtpUser?: string;
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
  const mail = readMailSettingsSnapshot();

  return {
    checkProvider,
    configuredProviders,
    dataForSeoLanguageCode: values.DATAFORSEO_LANGUAGE_CODE ?? "pl",
    dataForSeoLocationCode: values.DATAFORSEO_LOCATION_CODE ?? "",
    dataForSeoLocationName: values.DATAFORSEO_LOCATION_NAME ?? "",
    dataForSeoLoginHint: dataForSeoLogin ? maskSecret(dataForSeoLogin) : null,
    defaultNotificationEmail: values.DEFAULT_NOTIFICATION_EMAIL ?? "",
    googleServiceAccountFile,
    gscLanguageCode: values.GSC_LANGUAGE_CODE ?? "pl-PL",
    hasDataForSeoCredentials: Boolean(
      dataForSeoLogin &&
        dataForSeoPassword &&
        ((values.DATAFORSEO_LOCATION_CODE ?? "").trim() || (values.DATAFORSEO_LOCATION_NAME ?? "").trim())
    ),
    hasGoogleServiceAccountFile: Boolean(googleServiceAccountFile),
    hasGoogleServiceAccountJson: Boolean(googleServiceAccountJson),
    hasSearxngBaseUrl: Boolean((values.SEARXNG_BASE_URL ?? "").trim()),
    hasSerpApiKey: Boolean(serpApiKey),
    hasSerperApiKey: Boolean(serperApiKey),
    hasSmtpConfig: mail.hasSmtpConfig,
    resolvedProvider: resolved.provider,
    resolvedProviderError: resolved.error,
    savedToEnvLocal: true,
    searxngBaseUrl: values.SEARXNG_BASE_URL ?? "",
    searxngEngines: values.SEARXNG_ENGINES ?? "google",
    serpApiKeyHint: serpApiKey ? maskSecret(serpApiKey) : null,
    serpQueryStrategy: normalizeSerpQueryStrategy(values.SERP_QUERY_STRATEGY),
    serperApiKeyHint: serperApiKey ? maskSecret(serperApiKey) : null,
    smtpFromEmail: mail.fromEmail,
    smtpHost: mail.smtpHost,
    smtpPort: mail.smtpPort,
    smtpSecure: mail.smtpSecure,
    smtpUserHint: mail.smtpUserHint
  };
}

export function saveLocalSettings(input: SaveLocalSettingsInput): LocalSettings {
  const nextEnvLocal = { ...readEnvFile(ENV_LOCAL_PATH) };

  if (input.checkProvider !== undefined) {
    setEnvValue(nextEnvLocal, "CHECK_PROVIDER", normalizeCheckProvider(input.checkProvider));
  }
  if (input.serpQueryStrategy !== undefined) {
    setEnvValue(nextEnvLocal, "SERP_QUERY_STRATEGY", normalizeSerpQueryStrategy(input.serpQueryStrategy));
  }

  if (input.serperApiKey !== undefined) {
    setEnvValue(nextEnvLocal, "SERPER_API_KEY", input.serperApiKey.trim());
  }
  if (input.clearSerperApiKey) {
    setEnvValue(nextEnvLocal, "SERPER_API_KEY", "");
  }

  if (input.serpApiKey !== undefined) {
    setEnvValue(nextEnvLocal, "SERPAPI_API_KEY", input.serpApiKey.trim());
  }
  if (input.clearSerpApiKey) {
    setEnvValue(nextEnvLocal, "SERPAPI_API_KEY", "");
  }

  if (input.dataForSeoLogin !== undefined) {
    setEnvValue(nextEnvLocal, "DATAFORSEO_LOGIN", input.dataForSeoLogin.trim());
  }
  if (input.dataForSeoPassword !== undefined) {
    setEnvValue(nextEnvLocal, "DATAFORSEO_PASSWORD", input.dataForSeoPassword.trim());
  }
  if (input.clearDataForSeoCredentials) {
    setEnvValue(nextEnvLocal, "DATAFORSEO_LOGIN", "");
    setEnvValue(nextEnvLocal, "DATAFORSEO_PASSWORD", "");
  }
  if (input.dataForSeoLocationCode !== undefined) {
    setEnvValue(nextEnvLocal, "DATAFORSEO_LOCATION_CODE", input.dataForSeoLocationCode.trim());
  }
  if (input.dataForSeoLocationName !== undefined) {
    setEnvValue(nextEnvLocal, "DATAFORSEO_LOCATION_NAME", input.dataForSeoLocationName.trim());
  }
  if (input.dataForSeoLanguageCode !== undefined) {
    setEnvValue(nextEnvLocal, "DATAFORSEO_LANGUAGE_CODE", input.dataForSeoLanguageCode.trim() || "pl");
  }

  if (input.googleServiceAccountJson !== undefined) {
    const normalizedJson = input.googleServiceAccountJson.trim();
    if (normalizedJson) {
      JSON.parse(normalizedJson);
    }
    setEnvValue(nextEnvLocal, "GOOGLE_SERVICE_ACCOUNT_JSON", normalizedJson);
  }
  if (input.clearGoogleServiceAccountJson) {
    setEnvValue(nextEnvLocal, "GOOGLE_SERVICE_ACCOUNT_JSON", "");
  }

  if (input.googleServiceAccountFile !== undefined) {
    setEnvValue(nextEnvLocal, "GOOGLE_SERVICE_ACCOUNT_FILE", input.googleServiceAccountFile.trim());
  }
  if (input.gscLanguageCode !== undefined) {
    setEnvValue(nextEnvLocal, "GSC_LANGUAGE_CODE", input.gscLanguageCode.trim() || "pl-PL");
  }

  if (input.searxngBaseUrl !== undefined) {
    assertValidOptionalUrl(input.searxngBaseUrl, "SearXNG base URL");
    setEnvValue(nextEnvLocal, "SEARXNG_BASE_URL", input.searxngBaseUrl.trim());
  }
  if (input.searxngEngines !== undefined) {
    setEnvValue(nextEnvLocal, "SEARXNG_ENGINES", input.searxngEngines.trim() || "google");
  }

  if (input.smtpHost !== undefined) {
    setEnvValue(nextEnvLocal, "SMTP_HOST", input.smtpHost.trim());
  }
  if (input.smtpPort !== undefined) {
    const nextPort = input.smtpPort.trim() || "587";
    assertValidPort(nextPort, "SMTP port");
    setEnvValue(nextEnvLocal, "SMTP_PORT", nextPort);
  }
  if (input.smtpSecure !== undefined) {
    setEnvValue(nextEnvLocal, "SMTP_SECURE", input.smtpSecure ? "true" : "false");
  }
  if (input.smtpUser !== undefined) {
    setEnvValue(nextEnvLocal, "SMTP_USER", input.smtpUser.trim());
  }
  if (input.smtpPassword !== undefined) {
    setEnvValue(nextEnvLocal, "SMTP_PASSWORD", input.smtpPassword.trim());
  }
  if (input.clearSmtpPassword) {
    setEnvValue(nextEnvLocal, "SMTP_PASSWORD", "");
  }
  if (input.smtpFromEmail !== undefined) {
    assertValidOptionalEmail(input.smtpFromEmail, "SMTP from email");
    setEnvValue(nextEnvLocal, "MAIL_FROM", input.smtpFromEmail.trim());
  }
  if (input.defaultNotificationEmail !== undefined) {
    assertValidOptionalEmail(input.defaultNotificationEmail, "Default notification email");
    setEnvValue(nextEnvLocal, "DEFAULT_NOTIFICATION_EMAIL", input.defaultNotificationEmail.trim());
  }

  writeManagedEnvLocal(nextEnvLocal);
  return readLocalSettings();
}

function readResolvedEnv(): SettingsRecord {
  return {
    ...readEnvFile(ENV_PATH),
    ...readEnvFile(ENV_LOCAL_PATH),
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    )
  };
}

function readEnvFile(path: string): SettingsRecord {
  if (!existsSync(path)) {
    return {};
  }

  const content = readFileSync(path, "utf8");
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

function writeManagedEnvLocal(values: SettingsRecord) {
  const existingLines = existsSync(ENV_LOCAL_PATH) ? readFileSync(ENV_LOCAL_PATH, "utf8").split(/\r?\n/u) : [];
  const preservedLines = existingLines.filter((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/u);
    return !match || !MANAGED_KEYS.includes(match[1]! as (typeof MANAGED_KEYS)[number]);
  });

  const managedLines = [
    "# Managed by Index Checker UI",
    `CHECK_PROVIDER=${quote(values.CHECK_PROVIDER ?? "AUTO")}`,
    `SERP_QUERY_STRATEGY=${quote(values.SERP_QUERY_STRATEGY ?? "SITE_THEN_URL")}`,
    `SERPER_API_KEY=${quote(values.SERPER_API_KEY ?? "")}`,
    `SERPAPI_API_KEY=${quote(values.SERPAPI_API_KEY ?? "")}`,
    `DATAFORSEO_LOGIN=${quote(values.DATAFORSEO_LOGIN ?? "")}`,
    `DATAFORSEO_PASSWORD=${quote(values.DATAFORSEO_PASSWORD ?? "")}`,
    `DATAFORSEO_LOCATION_CODE=${quote(values.DATAFORSEO_LOCATION_CODE ?? "")}`,
    `DATAFORSEO_LOCATION_NAME=${quote(values.DATAFORSEO_LOCATION_NAME ?? "")}`,
    `DATAFORSEO_LANGUAGE_CODE=${quote(values.DATAFORSEO_LANGUAGE_CODE ?? "pl")}`,
    `SEARXNG_BASE_URL=${quote(values.SEARXNG_BASE_URL ?? "")}`,
    `SEARXNG_ENGINES=${quote(values.SEARXNG_ENGINES ?? "google")}`,
    `GOOGLE_SERVICE_ACCOUNT_JSON=${quote(values.GOOGLE_SERVICE_ACCOUNT_JSON ?? "")}`,
    `GOOGLE_SERVICE_ACCOUNT_FILE=${quote(values.GOOGLE_SERVICE_ACCOUNT_FILE ?? "")}`,
    `GSC_LANGUAGE_CODE=${quote(values.GSC_LANGUAGE_CODE ?? "pl-PL")}`,
    `SMTP_HOST=${quote(values.SMTP_HOST ?? "")}`,
    `SMTP_PORT=${quote(values.SMTP_PORT ?? "587")}`,
    `SMTP_SECURE=${quote(values.SMTP_SECURE ?? "false")}`,
    `SMTP_USER=${quote(values.SMTP_USER ?? "")}`,
    `SMTP_PASSWORD=${quote(values.SMTP_PASSWORD ?? "")}`,
    `MAIL_FROM=${quote(values.MAIL_FROM ?? "")}`,
    `DEFAULT_NOTIFICATION_EMAIL=${quote(values.DEFAULT_NOTIFICATION_EMAIL ?? "")}`,
    `CHECK_BATCH_SIZE=${quote(values.CHECK_BATCH_SIZE ?? process.env.CHECK_BATCH_SIZE ?? "25")}`,
    `CHECK_CACHE_DAYS=${quote(values.CHECK_CACHE_DAYS ?? process.env.CHECK_CACHE_DAYS ?? "7")}`
  ];

  const allLines = [...managedLines];
  if (preservedLines.some((line) => line.trim().length > 0)) {
    allLines.push("", "# Unmanaged entries preserved from your existing .env.local", ...preservedLines);
  }

  writeFileSync(ENV_LOCAL_PATH, `${allLines.join("\n")}\n`, "utf8");
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

function assertValidOptionalUrl(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  try {
    new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`);
  }
}

function assertValidOptionalEmail(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmed)) {
    throw new Error(`${label} must be a valid email address.`);
  }
}

function assertValidPort(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${label} must be a number between 1 and 65535.`);
  }
}
