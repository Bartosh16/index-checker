# Index Checker

Next.js app for checking owned-domain URLs from XML sitemaps.

## Setup

1. Copy `.env.example` to `.env`.
2. Set either `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_FILE` for GSC checks.
3. Or set `SERPER_API_KEY` for SERP-based fallback checks.
4. Add the Google service account as a user on the matching Search Console property if you use GSC.

## Commands

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Database is optional in the current MVP. If you still want local Postgres:

```bash
docker compose up -d
npm run db:push
npm run dev
```

On Windows you can also use:

```bat
install.bat
start.bat
```

## Notes

- Configure Serper or GSC directly in the in-app `Settings` panel. Settings are stored locally in `.env`.
- GSC uses the URL Inspection API with `webmasters.readonly`.
- GSC property can be left empty in the UI. The app will default to `sc-domain:<domain>`.
- If GSC credentials are not configured, the app falls back to Serper and checks `site:<full URL>`.
- The current MVP runs one sitemap check and lets you export the results directly to CSV without storing anything in a database.
