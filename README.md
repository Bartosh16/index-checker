# Index Checker

Batch checker for URLs pulled from XML sitemaps.

Current branch is intentionally database-free in the core flow:

- import URLs from a sitemap or sitemap index
- check indexing / visibility one URL at a time
- save projects and run history locally on disk
- reopen previous projects and refresh only URLs that were not indexed last time
- show results immediately in the UI
- compare the current run against the previous run
- export CSV
- keep provider configuration in local `.env`

That makes the app usable even when Postgres is unavailable or unwanted. The checker and the project history work without Postgres. A database can still be added later as an optional persistence layer without blocking the core app.

## What it checks today

One run uses one active provider at a time:

- `Google Search Console`
- `Serper`
- `SerpApi`
- `DataForSEO`
- `SearXNG`

Supported modes:

- `AUTO` - first configured provider wins
- forced provider mode - use exactly the provider selected in Settings

For SERP-based providers you can choose the query strategy:

- `SITE_ONLY` - only `site:<full-url>`
- `SITE_THEN_URL` - first `site:<full-url>`, then retry with the raw URL

The result is treated as a hit only when the normalized result URL exactly matches the checked URL. Similar URLs are not counted as indexed.

## Why no required DB in the main flow

Earlier iterations used Prisma + Postgres for projects, runs and cached results. In practice that created friction before the core checker was even usable.

So the current architecture is:

- core checker: no database required
- settings: stored in local `.env`
- projects and run history: stored in `.index-checker-data/projects.json`
- output: immediate table + CSV
- future database: optional, not required for running checks

This keeps database interference non-critical by design.

## Requirements

- Node.js 22+
- npm
- optional: Docker Desktop if you want to experiment with Postgres later

## Quick start

### Windows

```bat
install.bat
start.bat
```

`start.bat` starts the dev server and opens the app automatically in your browser.

### Manual

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001) if you use the bundled Windows start script defaults.

## Configuration

You can configure everything from the in-app `Settings` panel. The UI writes to `.env`.

### Core settings

```env
CHECK_PROVIDER="AUTO"
SERP_QUERY_STRATEGY="SITE_THEN_URL"
CHECK_BATCH_SIZE="25"
CHECK_CACHE_DAYS="7"
```

### Google Search Console

Use one of:

```env
GOOGLE_SERVICE_ACCOUNT_JSON=""
GOOGLE_SERVICE_ACCOUNT_FILE=""
GSC_LANGUAGE_CODE="pl-PL"
```

Notes:

- the service account must be added to the relevant Search Console property
- the app can infer a default property like `sc-domain:example.com`
- GSC property ownership cannot be reliably discovered from page source alone, so this still comes from Search Console configuration

### Serper

```env
SERPER_API_KEY=""
```

### SerpApi

```env
SERPAPI_API_KEY=""
```

### DataForSEO

At minimum:

```env
DATAFORSEO_LOGIN=""
DATAFORSEO_PASSWORD=""
DATAFORSEO_LOCATION_CODE=""
DATAFORSEO_LOCATION_NAME=""
DATAFORSEO_LANGUAGE_CODE="pl"
```

Use either `DATAFORSEO_LOCATION_CODE` or `DATAFORSEO_LOCATION_NAME`.

### SearXNG

```env
SEARXNG_BASE_URL=""
SEARXNG_ENGINES="google"
```

Example:

```env
SEARXNG_BASE_URL="https://your-searxng.example"
SEARXNG_ENGINES="google"
```

Some public SearXNG instances disable JSON or do not expose Google, so this option works best with your own instance or a trusted one.

## How the checker works

1. Fetch the provided sitemap.
2. Support both `urlset` and `sitemapindex`.
3. Deduplicate normalized URLs.
4. Ignore URLs outside the selected domain.
5. Run checks with limited concurrency.
6. Save the run when it belongs to a named project.
7. Compare the current run against the previous one for the same project.
8. Show live results in the table.
9. Export the whole batch as CSV.

No crawling beyond sitemap discovery happens in this branch.

## UI overview

- `Projects` panel with saved local projects
- `Settings` panel for provider selection and credentials
- `Project run` form for sitemap URL, domain, property, batch size, `hl`, `gl`
- `Run history` list for reopening previous scans
- `Results` table with filters, lookup explanation, and change tracking
- `Dark mode`
- `Export CSV`

## Developer commands

```bash
npm run dev
npm run lint
npm run test
npm run build
```

Legacy database scripts still exist for future work:

```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

They are not required for the current MVP flow.

## Notes on provider choice

Recommended starting order:

1. `Google Search Console` for owned domains
2. `Serper` for lightweight SERP checks
3. `SerpApi` or `DataForSEO` when you want another paid SERP source
4. `SearXNG` when you want a self-hosted / open-source option

`AUTO` currently resolves providers in this order when they are configured:

1. `Google Search Console`
2. `Serper`
3. `DataForSEO`
4. `SerpApi`
5. `SearXNG`

If you want a different provider, force it in Settings.

## Tests covered

- sitemap parsing for `urlset`
- sitemap index expansion
- URL deduplication
- ignoring off-domain URLs
- exact URL match logic for SERP results
- provider resolution
- SERP query strategy fallback

## What is still future work

- background jobs instead of keeping a browser tab open for very large runs
- email notification after completion
- optional database backend for multi-user or server-hosted deployments
