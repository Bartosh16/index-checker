# Index Checker

Index Checker is a Next.js app for checking sitemap URLs from your own domains and saving project history.

Current MVP includes:

- project save/load
- dark mode
- one-click provider setup from the UI
- API key verification from the UI
- exclude rules for junk URLs from sitemaps
- rerun mode for only previously not indexed URLs
- local project/run persistence on disk
- background project runs
- optional email notification after a whole project finishes
- CSV export
- dual persistence modes:
  - local file mode
  - hosted Postgres mode for access from anywhere

The checker still works without a database locally, but it can now run in hosted mode with Postgres-backed persistence.

## Start here

Choose one path:

- local operator: use this README
- AI-assisted deploy: open [BOOTSTRAP_FOR_AI.md](./BOOTSTRAP_FOR_AI.md)
- manual hosted deploy: open [DEPLOYMENT.md](./DEPLOYMENT.md)

Hosted template shortcut:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Bartosh16/index-checker)

## How it works

1. You create or load a project.
2. You paste a sitemap URL.
3. The app imports URLs from `urlset` or `sitemapindex`.
4. URLs outside the selected domain are ignored.
5. Optional exclude rules remove junk URLs before checks start.
6. The active provider checks indexing / SERP visibility.
7. The run is saved locally so you can come back later.
8. Next time you can rerun only URLs that were `NOT_INDEXED` in the last completed run.

## What providers are supported

- `Google Search Console`
- `Serper`
- `SerpApi`
- `DataForSEO`
- `SearXNG`

Provider mode options:

- `AUTO` - first fully configured provider wins
- forced provider mode - exactly the provider selected in Settings is used

SERP query strategy options:

- `SITE_ONLY` - only `site:<full-url>`
- `SITE_THEN_URL` - first `site:<full-url>`, then raw URL fallback

Exact-match logic is strict. Similar URLs are not treated as indexed.

## Important architecture note

This app now supports two persistence strategies:

- `local`
  - no database required
  - provider settings: read from `.env` and `.env.local`
  - UI-saved secrets: written to `.env.local`
  - projects and run history: written to `.index-checker-data/projects.json`
- `postgres`
  - uses `DATABASE_URL`
  - intended for Netlify + Supabase or any hosted Postgres
  - stores project/run state in Postgres so the app can be used remotely

The design goal is still the same:

- core checker should not be blocked by the database path
- provider settings: read from `.env` and `.env.local`
- UI-saved secrets: written to `.env.local`
- background runs: handled by the Node server process

That means:

- local use works immediately
- self-hosted VPS / Docker use is fine
- Netlify + Supabase is now a supported starter path
- serverless platforms with hard request/runtime limits are not the best fit for background runs in this version

## Requirements

- Node.js `22.13+` recommended
- npm
- optional: Docker Desktop if you want to experiment with Postgres later

The current environment in this repo showed warnings on `22.11.0`, so `22.13+` is the safer floor.

## Quick start on Windows

### 1. Install dependencies

```bat
install.bat
```

What it does:

- checks Node and npm
- installs packages
- generates Prisma Client
- optionally offers Docker / Prisma DB steps

The app still works if you skip the database steps.

### 2. Start the app

```bat
start.bat
```

What it does:

- starts the Next.js dev server
- opens the browser automatically
- defaults to [http://127.0.0.1:3001](http://127.0.0.1:3001)

## Hosted quick start

If you want the app available from anywhere and backed by Postgres:

1. read [DEPLOYMENT.md](./DEPLOYMENT.md)
2. run:

```bash
npm install
npm run setup:hosted
```

3. deploy to Netlify
4. run:

```bash
npm run smoke:check -- https://your-site.netlify.app
```

5. optionally seed the first project:

```bash
npm run smoke:check -- https://your-site.netlify.app --project-name "Main project" --domain "example.com" --sitemap-url "https://example.com/sitemap.xml"
```

## Manual start

```bash
npm install
npm run dev -- -H 127.0.0.1 -p 3001
```

## First setup in the UI

### 1. Open `Settings`

You can configure providers directly from the app.

### 2. Paste credentials

Examples:

- `Serper API key`
- `SerpApi key`
- `DataForSEO login/password`
- `Google service account JSON`
- `SMTP settings`

### 3. Click `Save and verify`

Each provider section has a verification button.

Flow is:

1. current form values are saved server-side
2. the app verifies the provider from the backend
3. the UI shows only masked hints, not raw secrets

### 4. Create a project

Recommended project fields:

- project name
- domain
- sitemap URL
- optional GSC property
- optional notification email
- optional exclude rules

### 5. Run a check

You can:

- run all sitemap URLs
- rerun only URLs that were not indexed in the last completed run

## Where settings are stored

Two files matter:

- `.env` - base defaults and optional manual config
- `.env.local` - UI-managed config and secrets

Priority:

1. process environment
2. `.env.local`
3. `.env`

So the safe everyday workflow is:

- keep non-sensitive defaults in `.env`
- use the UI to save secrets into `.env.local`

## Security model for API keys

This version is designed to be practical and low-support:

- secrets are saved on the server side only
- the browser never receives raw API keys back after save
- the UI shows masked hints only
- `.env.local` is ignored by git
- verification runs happen from backend routes

This is strong enough for a typical local install or self-hosted internal tool.

What it is not:

- not a multi-tenant SaaS secret vault
- not hardware-backed key management

If you later turn this into a multi-user hosted product, move secrets to a dedicated encrypted store.

## Project data and history

Projects and run history are stored in one of two places:

- local mode:

```text
.index-checker-data/projects.json
```

- hosted mode:

```text
public.index_checker_app_state
```

Hosted mode is enabled with:

```env
PERSISTENCE_DRIVER="postgres"
DATABASE_URL="..."
```

Saved data includes:

- project settings
- last completed run summary
- full run history
- rows checked in each run
- comparison against the previous completed run

That lets you:

- close the app
- reopen later
- return to a project
- rerun only still-not-indexed URLs

## Exclude rules

Use exclude rules when a sitemap contains junk.

Rules are one per line.

Supported patterns:

- exact URL
- prefix match ending with `*`
- comment lines starting with `#`

Examples:

```text
# tag pages
https://example.com/tag/*

# one exact URL
https://example.com/privacy-policy/
```

## Email notifications

Email is optional and used only for saved project runs.

To enable it:

1. open `Settings`
2. fill SMTP host, port, user, password, from email
3. optionally add a default notification email
4. click `Save and verify`
5. optionally override recipient inside a specific project

If a project has its own notification email, that wins.
If not, the default notification email is used.

## Google Search Console note

The app can infer a fallback property like:

```text
sc-domain:example.com
```

But it cannot reliably discover the real Search Console property from page source alone.

Why:

- GSC ownership is not a page-level HTML fact
- the property may be domain-level or URL-prefix-level
- many sites expose no trustworthy clue in source code

So GSC property remains an explicit configuration value.

## Server deployment

This version is best for:

- local machine
- Windows mini-server
- VPS
- Docker on a regular Node host
- Netlify + Supabase for a single-owner hosted deployment

Recommended for self-hosting:

- long-lived Node process or Netlify-hosted Next.js runtime
- writable disk for `.index-checker-data` in local mode
- writable `.env.local`
- or Postgres-backed persistence in hosted mode
- outbound access to provider APIs and SMTP

Not ideal for:

- strict serverless environments where background work may be killed after the request ends

For the current hosted starter path, Postgres solves persistence, but very large runs will still eventually want a chunked queue worker model.

## Performance notes

Performance depends mostly on:

- provider latency
- batch size
- provider quotas / throttling
- whether you rerun full sitemap or only prior `NOT_INDEXED`

For large projects:

- saved state matters a lot
- exclude rules help
- rerunning only not-indexed URLs reduces cost and time sharply

Current default batch size is conservative. You can raise it carefully if your provider and network tolerate it.

## Local scripts

### Install

```bat
install.bat
```

### Start

```bat
start.bat
```

### Start wrapper

```bat
skrypt.bat
```

### Hosted setup

```bash
npm run setup:hosted
```

### Hosted smoke test

```bash
npm run smoke:check -- https://your-site.netlify.app
```

## Environment example

See [.env.example](./.env.example).

It includes:

- provider config
- optional SMTP config
- runtime tuning
- optional DB URL
- persistence mode
- app base URL for hosted smoke checks

## Development commands

```bash
npm run dev
npm run lint
npm run test
npm run build
```

Legacy DB commands still exist:

```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

They are not required for the current app flow.

## Recommended provider order

For your own domains:

1. `Google Search Console`
2. `Serper`
3. `SerpApi` or `DataForSEO`
4. `SearXNG`

`AUTO` resolves in this order when configured:

1. `Google Search Console`
2. `Serper`
3. `DataForSEO`
4. `SerpApi`
5. `SearXNG`

## Tests currently cover

- sitemap parsing for `urlset`
- sitemap index expansion
- URL deduplication
- off-domain URL filtering
- exact-match SERP URL logic
- provider resolution
- SERP query strategy fallback

## What is still future work

- stronger true background queue for serverless environments
- encrypted-at-rest secrets for multi-user hosting
- more normalized relational Postgres persistence beyond the current JSONB app-state starter mode
- provider-specific rate dashboards and quotas in UI
