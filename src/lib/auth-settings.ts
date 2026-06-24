import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createPasswordHash } from "@/lib/auth";

const ENV_LOCAL_PATH = resolve(process.cwd(), ".env.local");
const AUTH_MANAGED_KEYS = [
  "APP_PASSWORD",
  "INDEX_CHECKER_PASSWORD",
  "APP_PASSWORD_HASH",
  "APP_AUTH_SECRET",
  "APP_PASSWORD_RESET_TOKEN",
  "APP_PASSWORD_RESET_TOKEN_HASH"
] as const;

type EnvRecord = Record<string, string>;

export async function saveAdminPassword(password: string) {
  const values = readEnvFile(ENV_LOCAL_PATH);
  values.APP_PASSWORD = "";
  values.INDEX_CHECKER_PASSWORD = "";
  values.APP_PASSWORD_HASH = await createPasswordHash(password);
  values.APP_AUTH_SECRET = values.APP_AUTH_SECRET || process.env.APP_AUTH_SECRET?.trim() || randomUUID();
  writeManagedAuthEnv(values);
  applyAuthEnv(values);
}

export async function savePasswordResetToken(token: string) {
  const values = readEnvFile(ENV_LOCAL_PATH);
  values.APP_PASSWORD_RESET_TOKEN = "";
  values.APP_PASSWORD_RESET_TOKEN_HASH = token.trim() ? await createPasswordHash(token.trim()) : "";
  values.APP_AUTH_SECRET = values.APP_AUTH_SECRET || process.env.APP_AUTH_SECRET?.trim() || randomUUID();
  writeManagedAuthEnv(values);
  applyAuthEnv(values);
}

function readEnvFile(path: string): EnvRecord {
  if (!existsSync(path)) {
    return {};
  }

  const content = readFileSync(path, "utf8");
  const env: EnvRecord = {};

  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    if (!match) {
      continue;
    }

    env[match[1]!] = unquote((match[2] ?? "").trim());
  }

  return env;
}

function writeManagedAuthEnv(values: EnvRecord) {
  const existingLines = existsSync(ENV_LOCAL_PATH) ? readFileSync(ENV_LOCAL_PATH, "utf8").split(/\r?\n/u) : [];
  const preservedLines = existingLines.filter((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/u);
    return !match || !AUTH_MANAGED_KEYS.includes(match[1]! as (typeof AUTH_MANAGED_KEYS)[number]);
  });

  const managedLines = [
    "# Managed by Index Checker auth UI",
    `APP_PASSWORD=${quote(values.APP_PASSWORD ?? "")}`,
    `INDEX_CHECKER_PASSWORD=${quote(values.INDEX_CHECKER_PASSWORD ?? "")}`,
    `APP_PASSWORD_HASH=${quote(values.APP_PASSWORD_HASH ?? process.env.APP_PASSWORD_HASH ?? "")}`,
    `APP_AUTH_SECRET=${quote(values.APP_AUTH_SECRET ?? process.env.APP_AUTH_SECRET ?? "")}`,
    `APP_PASSWORD_RESET_TOKEN=${quote(values.APP_PASSWORD_RESET_TOKEN ?? "")}`,
    `APP_PASSWORD_RESET_TOKEN_HASH=${quote(values.APP_PASSWORD_RESET_TOKEN_HASH ?? process.env.APP_PASSWORD_RESET_TOKEN_HASH ?? "")}`
  ];

  const allLines = [...managedLines];
  if (preservedLines.some((line) => line.trim().length > 0)) {
    allLines.push("", "# Other .env.local entries preserved", ...preservedLines);
  }

  writeFileSync(ENV_LOCAL_PATH, `${allLines.join("\n")}\n`, "utf8");
}

function applyAuthEnv(values: EnvRecord) {
  for (const key of AUTH_MANAGED_KEYS) {
    process.env[key] = values[key] ?? "";
  }
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
