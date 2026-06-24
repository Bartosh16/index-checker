# Bootstrap For AI

Use this file when a client opens the repository in Codex or Claude Code and wants to self-deploy the app.

## Goal

Guide the user from zero to a working hosted deployment on Netlify + Supabase, then help them create the first project by providing a domain or sitemap URL.

## Operating mode

You are not here to explain architecture first. You are here to get the deployment working with the least possible user friction.

## Rules

1. Ask only the questions that unblock the next step.
2. Prefer doing work for the user instead of handing them a long checklist.
3. Do not ask the user to paste secrets into chat if the CLI or provider UI can handle them more safely.
4. Treat the user as a non-technical operator unless they clearly show otherwise.
5. Keep the app in one of two modes:
   - `local`: filesystem persistence
   - `hosted`: `PERSISTENCE_DRIVER=postgres`
6. For hosted mode, prioritize:
   - Supabase for Postgres
   - Netlify for hosting
7. If cloud account creation is required, pause and send the user directly to the official signup page. Resume immediately after they confirm they are back.

## Required end state

Before you stop, make sure all of these are true:

1. The app is deployed.
2. `/api/health` returns `ok: true`.
3. Persistence is `postgres` in hosted mode.
4. The user can open the app URL.
5. The first project is created or the user is already on the screen where they only need to paste the sitemap/domain.

## Hosted deployment flow

Follow this order:

1. Confirm whether the user wants:
   - `hosted` on Netlify + Supabase
   - or `local only`
2. If hosted:
   - confirm they have a Supabase account
   - confirm they have a Netlify account
3. If they do not have either account:
   - send them to create it
   - wait
4. Run:

```bash
npm install
npm run setup:hosted
```

5. If `DATABASE_URL` is still missing after setup:
   - help the user get it from Supabase
   - write it into `.env.local`
6. Ensure these env vars exist locally and in Netlify:

```env
PERSISTENCE_DRIVER="postgres"
DATABASE_URL="..."
APP_BASE_URL="https://<their-site>.netlify.app"
```

7. If the user is okay with CLI-driven deploy:
   - use Netlify CLI
   - otherwise use the Netlify UI and the `Deploy to Netlify` path from the README
8. After deploy, run:

```bash
npm run smoke:check -- https://<their-site>.netlify.app
```

9. If the user already knows the first sitemap/domain, seed the first project:

```bash
npm run smoke:check -- https://<their-site>.netlify.app --project-name "Main project" --domain "example.com" --sitemap-url "https://example.com/sitemap.xml"
```

## When Supabase setup is needed

Prefer this operator flow:

1. Let the user create or open a Supabase project in the browser.
2. Obtain the Postgres `DATABASE_URL`.
3. Store it in `.env.local`.
4. If the app state table does not exist yet:
   - apply the SQL from `supabase/migrations/20260619000100_app_state.sql`
   - or let the app auto-create it on first write if DB permissions allow

## If anything fails

Check in this order:

1. `DATABASE_URL`
2. `PERSISTENCE_DRIVER`
3. Netlify environment variables
4. `/api/health`
5. build logs

## Final handoff checklist

Before stopping, tell the user:

1. app URL
2. whether persistence is `local` or `postgres`
3. whether the first project was created
4. what still needs to be filled in from the UI:
   - provider API keys
   - SMTP if they want email notifications
