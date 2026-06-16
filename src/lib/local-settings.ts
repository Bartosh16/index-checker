import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");

type SettingsRecord = Record<string, string>;

export type LocalSettings = {
  gscLanguageCode: string;
  googleServiceAccountFile: string;
  hasGoogleServiceAccountJson: boolean;
  hasGoogleServiceAccountFile: boolean;
  hasSerperApiKey: boolean;
  serperApiKeyHint: string | null;
};

export type SaveLocalSettingsInput = {
  clearGoogleServiceAccountJson?: boolean;
  clearSerperApiKey?: boolean;
  googleServiceAccountFile?: string;
  googleServiceAccountJson?: string;
  gscLanguageCode?: string;
  serperApiKey?: string;
};

export function readLocalSettings(): LocalSettings {
  const env = readEnvFile();
  const serperApiKey = process.env.SERPER_API_KEY ?? env.SERPER_API_KEY ?? "";
  const googleServiceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  const googleServiceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? env.GOOGLE_SERVICE_ACCOUNT_FILE ?? "";
  const gscLanguageCode = process.env.GSC_LANGUAGE_CODE ?? env.GSC_LANGUAGE_CODE ?? "pl-PL";

  return {
    gscLanguageCode,
    googleServiceAccountFile,
    hasGoogleServiceAccountFile: Boolean(googleServiceAccountFile.trim()),
    hasGoogleServiceAccountJson: Boolean(googleServiceAccountJson.trim()),
    hasSerperApiKey: Boolean(serperApiKey.trim()),
    serperApiKeyHint: serperApiKey.trim() ? maskSecret(serperApiKey) : null
  };
}

export function saveLocalSettings(input: SaveLocalSettingsInput): LocalSettings {
  const env = readEnvFile();
  const nextEnv: SettingsRecord = { ...env };

  if (input.serperApiKey !== undefined) {
    nextEnv.SERPER_API_KEY = input.serperApiKey.trim();
    process.env.SERPER_API_KEY = nextEnv.SERPER_API_KEY;
  }
  if (input.clearSerperApiKey) {
    nextEnv.SERPER_API_KEY = "";
    process.env.SERPER_API_KEY = "";
  }

  if (input.googleServiceAccountJson !== undefined) {
    const normalizedJson = input.googleServiceAccountJson.trim();
    if (normalizedJson) {
      JSON.parse(normalizedJson);
    }
    nextEnv.GOOGLE_SERVICE_ACCOUNT_JSON = normalizedJson;
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = normalizedJson;
  }
  if (input.clearGoogleServiceAccountJson) {
    nextEnv.GOOGLE_SERVICE_ACCOUNT_JSON = "";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "";
  }

  if (input.googleServiceAccountFile !== undefined) {
    nextEnv.GOOGLE_SERVICE_ACCOUNT_FILE = input.googleServiceAccountFile.trim();
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = nextEnv.GOOGLE_SERVICE_ACCOUNT_FILE;
  }

  if (input.gscLanguageCode !== undefined) {
    nextEnv.GSC_LANGUAGE_CODE = input.gscLanguageCode.trim() || "pl-PL";
    process.env.GSC_LANGUAGE_CODE = nextEnv.GSC_LANGUAGE_CODE;
  }

  writeEnvFile(nextEnv);
  return readLocalSettings();
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

    const key = match[1]!;
    const rawValue = match[2] ?? "";
    env[key] = unquote(rawValue.trim());
  }

  return env;
}

function writeEnvFile(values: SettingsRecord) {
  const lines = [
    `DATABASE_URL=${quote(values.DATABASE_URL ?? process.env.DATABASE_URL ?? "")}`,
    `SERPER_API_KEY=${quote(values.SERPER_API_KEY ?? "")}`,
    "",
    "# Use one of the two Google auth options below.",
    `GOOGLE_SERVICE_ACCOUNT_JSON=${quote(values.GOOGLE_SERVICE_ACCOUNT_JSON ?? "")}`,
    `GOOGLE_SERVICE_ACCOUNT_FILE=${quote(values.GOOGLE_SERVICE_ACCOUNT_FILE ?? "")}`,
    `GSC_LANGUAGE_CODE=${quote(values.GSC_LANGUAGE_CODE ?? "pl-PL")}`,
    "",
    `CHECK_BATCH_SIZE=${quote(values.CHECK_BATCH_SIZE ?? process.env.CHECK_BATCH_SIZE ?? "25")}`,
    `CHECK_CACHE_DAYS=${quote(values.CHECK_CACHE_DAYS ?? process.env.CHECK_CACHE_DAYS ?? "7")}`
  ];

  writeFileSync(ENV_PATH, `${lines.join("\n")}\n`, "utf8");
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
