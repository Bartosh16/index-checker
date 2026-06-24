import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = resolve(process.cwd());
const ENV_EXAMPLE_PATH = resolve(ROOT, ".env.example");
const ENV_LOCAL_PATH = resolve(ROOT, ".env.local");
const DEPLOYMENT_ENV_PATH = resolve(ROOT, "deployment", "hosted-env.txt");

async function main() {
  const envExample = existsSync(ENV_EXAMPLE_PATH) ? await readFile(ENV_EXAMPLE_PATH, "utf8") : "";
  const currentEnvLocal = existsSync(ENV_LOCAL_PATH) ? await readFile(ENV_LOCAL_PATH, "utf8") : "";
  const env = parseEnv(`${envExample}\n${currentEnvLocal}`);

  const rl = createInterface({ input, output });

  output.write("\n=== Index Checker hosted setup ===\n\n");
  output.write("This helper prepares local files for Netlify + Supabase hosted mode.\n");
  output.write("It does not create cloud accounts for you, but it gives Codex/Claude Code a clean starting point.\n\n");

  const useHostedMode = await askYesNo(
    rl,
    "Prepare this repo for hosted Postgres persistence? [Y/n] ",
    true
  );

  if (!useHostedMode) {
    output.write("No changes made.\n");
    rl.close();
    return;
  }

  const databaseUrl =
    (await rl.question(`Supabase / Postgres DATABASE_URL [${env.DATABASE_URL || "leave blank for later"}]: `)).trim() ||
    env.DATABASE_URL ||
    "";
  const appBaseUrl =
    (await rl.question(`App base URL for smoke checks [${env.APP_BASE_URL || "https://your-site.netlify.app"}]: `)).trim() ||
    env.APP_BASE_URL ||
    "https://your-site.netlify.app";

  const nextEnvLocal = {
    ...parseEnv(currentEnvLocal),
    APP_BASE_URL: appBaseUrl,
    PERSISTENCE_DRIVER: "postgres",
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {})
  };

  await writeManagedEnvLocal(nextEnvLocal);
  await writeDeploymentEnvFile(nextEnvLocal);

  output.write("\nPrepared:\n");
  output.write(`- ${ENV_LOCAL_PATH}\n`);
  output.write(`- ${DEPLOYMENT_ENV_PATH}\n\n`);
  output.write("Suggested next steps:\n");
  output.write("1. If needed, create a Supabase project in the browser.\n");
  output.write("2. Copy the real DATABASE_URL into .env.local if it is still blank.\n");
  output.write("3. Set the same variables in Netlify.\n");
  output.write("4. Deploy.\n");
  output.write("5. Run: npm run smoke:check -- https://your-site.netlify.app\n\n");

  if (!databaseUrl) {
    output.write("Note: DATABASE_URL is still empty. Hosted mode will not work until you fill it in.\n");
  }

  rl.close();
}

async function writeManagedEnvLocal(values) {
  const existingContent = existsSync(ENV_LOCAL_PATH) ? await readFile(ENV_LOCAL_PATH, "utf8") : "";
  const existingLines = existingContent.split(/\r?\n/u);
  const managedKeys = new Set(["DATABASE_URL", "PERSISTENCE_DRIVER", "APP_BASE_URL"]);
  const preservedLines = existingLines.filter((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/u);
    return !match || !managedKeys.has(match[1]);
  });

  const managedLines = [
    "# Managed by scripts/setup-hosted.mjs",
    `PERSISTENCE_DRIVER=${quote(values.PERSISTENCE_DRIVER || "postgres")}`,
    `DATABASE_URL=${quote(values.DATABASE_URL || "")}`,
    `APP_BASE_URL=${quote(values.APP_BASE_URL || "")}`
  ];

  const next = [...managedLines];
  if (preservedLines.some((line) => line.trim().length > 0)) {
    next.push("", "# Preserved entries", ...preservedLines);
  }

  await writeFile(ENV_LOCAL_PATH, `${next.join("\n")}\n`, "utf8");
}

async function writeDeploymentEnvFile(values) {
  await mkdir(dirname(DEPLOYMENT_ENV_PATH), { recursive: true });
  const lines = [
    "# Copy these into Netlify environment variables",
    `PERSISTENCE_DRIVER=${values.PERSISTENCE_DRIVER || "postgres"}`,
    `DATABASE_URL=${values.DATABASE_URL || ""}`,
    `APP_BASE_URL=${values.APP_BASE_URL || ""}`
  ];
  await writeFile(DEPLOYMENT_ENV_PATH, `${lines.join("\n")}\n`, "utf8");
}

function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    if (!match) {
      continue;
    }
    env[match[1]] = unquote((match[2] || "").trim());
  }
  return env;
}

function quote(value) {
  return `"${String(value).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/gu, '"').replace(/\\\\/gu, "\\");
  }
  return trimmed;
}

async function askYesNo(rl, prompt, defaultValue) {
  const answer = (await rl.question(prompt)).trim().toLowerCase();
  if (!answer) {
    return defaultValue;
  }
  return answer === "y" || answer === "yes" || answer === "t" || answer === "tak";
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
