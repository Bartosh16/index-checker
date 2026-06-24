# Deployment

This document is the manual fallback if the user is not using Codex or Claude Code.

## Recommended target

- Hosting: Netlify
- Database: Supabase Postgres
- Persistence mode: `postgres`

## Why this path

- Netlify supports modern Next.js deployments with zero-config detection for most projects.
- Supabase gives you managed Postgres and access from anywhere.
- The current app can run in:
  - `local` mode using a filesystem JSON store
  - `postgres` mode using Postgres-backed app state

## One-time setup

### 1. Create accounts

Create or log into:

- Netlify
- Supabase
- GitHub

### 2. Clone the repository

```bash
git clone <your-repo-url>
cd index-checker
npm install
```

### 3. Prepare hosted mode

```bash
npm run setup:hosted
```

That script prepares:

- `.env.local`
- `deployment/hosted-env.txt`

### 4. Fill in the real database URL

Set these locally:

```env
PERSISTENCE_DRIVER="postgres"
DATABASE_URL="..."
APP_BASE_URL="https://your-site.netlify.app"
```

### 5. Prepare Supabase

Apply:

```sql
supabase/migrations/20260619000100_app_state.sql
```

This creates the app-state table used by hosted persistence.

If your DB user has permission to create tables, the app can also auto-create this table on first write. The SQL migration is still the cleaner route.

### 6. Deploy to Netlify

Use either:

- Netlify UI
- Netlify CLI
- Deploy to Netlify button in the README

Make sure Netlify has these env vars:

```env
PERSISTENCE_DRIVER=postgres
DATABASE_URL=...
APP_BASE_URL=https://your-site.netlify.app
```

Plus any provider secrets you want later:

- `SERPER_API_KEY`
- `SERPAPI_API_KEY`
- `DATAFORSEO_*`
- `GOOGLE_SERVICE_ACCOUNT_*`
- `SMTP_*`

### 7. Smoke test

```bash
npm run smoke:check -- https://your-site.netlify.app
```

### 8. Optional: seed the first project

```bash
npm run smoke:check -- https://your-site.netlify.app --project-name "Main project" --domain "example.com" --sitemap-url "https://example.com/sitemap.xml"
```

## Hosted mode behavior

In hosted mode, project state is stored in Postgres instead of `.index-checker-data/projects.json`.

That means:

- you can access the app from anywhere
- projects and run history survive restarts
- the same UI continues to work

## Current limitation

Hosted mode now persists state remotely, but the app is still optimized for a single-owner deployment.

For a later phase, the next improvements should be:

1. owner auth
2. chunked queue workers for very large runs
3. provider secret storage in a dedicated encrypted system
4. a more normalized relational schema
