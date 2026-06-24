const [, , baseUrlArg, ...restArgs] = process.argv;

if (!baseUrlArg) {
  console.error("Usage: npm run smoke:check -- <base-url> [--project-name \"...\"] [--domain \"...\"] [--sitemap-url \"...\"] [--notification-email \"...\"]");
  process.exit(1);
}

const baseUrl = normalizeBaseUrl(baseUrlArg);
const args = parseArgs(restArgs);

await run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function run() {
  const health = await fetchJson(`${baseUrl}/api/health`);
  console.log("Health:");
  console.log(JSON.stringify(health, null, 2));

  if (!health.ok) {
    throw new Error("Health check failed.");
  }

  if (args["project-name"] && args.domain && args["sitemap-url"]) {
    const payload = {
      domain: args.domain,
      name: args["project-name"],
      notificationEmail: args["notification-email"] || "",
      sitemapUrl: args["sitemap-url"]
    };

    const created = await fetchJson(`${baseUrl}/api/local-projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("\nSeeded first project:");
    console.log(JSON.stringify(created, null, 2));
  } else {
    console.log("\nProject seeding skipped. Pass --project-name, --domain and --sitemap-url to create the first project automatically.");
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}.`);
  }
  return data;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/u, "");
}

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw?.startsWith("--")) {
      continue;
    }

    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = "true";
      continue;
    }

    result[key] = next;
    index += 1;
  }

  return result;
}
