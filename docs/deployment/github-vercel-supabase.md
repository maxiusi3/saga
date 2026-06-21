# GitHub Actions, Vercel, and Supabase Deployment Runbook

This project deploys `packages/web` to Vercel and uses Supabase for auth, database, and storage. GitHub Actions is the deployment controller.

## Deployment Flow

Pull requests run:

1. `npm ci`
2. `npm run test:infra`
3. `npm run type-check`
4. `npm run lint`
5. `npm test --workspace=packages/web -- --runInBand`
6. `vercel pull --yes --environment=preview`
7. `vercel build`
8. `vercel deploy --prebuilt`

Pushes to `main` run:

1. The same CI gate.
2. `supabase link --project-ref "$SUPABASE_PROJECT_REF"`.
3. `supabase db push --linked`.
4. `vercel pull --yes --environment=production`.
5. `vercel build --prod`.
6. `vercel deploy --prebuilt --prod`.

Supabase migrations run before production Vercel deploys so API routes do not reach production before the database shape exists.

## GitHub Secrets

Create these in GitHub repository settings under `Settings > Secrets and variables > Actions`.

| Secret | Scope | Purpose |
| --- | --- | --- |
| `VERCEL_TOKEN` | Actions | Vercel CLI authentication token. |
| `VERCEL_ORG_ID` | Actions | Vercel team or user id for this project. |
| `VERCEL_PROJECT_ID` | Actions | Vercel project id for `packages/web`. |
| `SUPABASE_ACCESS_TOKEN` | Actions | Supabase CLI authentication token. |
| `SUPABASE_PROJECT_REF` | Actions | Supabase project reference, the `PROJECT_REF` in `https://PROJECT_REF.supabase.co`. |
| `SUPABASE_DB_PASSWORD` | Actions | Production database password used by Supabase CLI migration commands. |

Do not put application runtime secrets only in GitHub unless the workflow itself needs them. Runtime secrets belong in Vercel environment variables.

## Vercel Project

Set the Vercel project root directory to `packages/web`.

The project config in `packages/web/vercel.json` expects:

| Field | Value |
| --- | --- |
| Framework | Next.js |
| Install Command | `cd ../.. && npm ci` |
| Build Command | `cd ../.. && npm run build:vercel` |
| Output Directory | `.next` |

The Vercel cron job calls `/api/admin/cleanup-invitations` every day at 09:00 UTC.

## Vercel Environment Variables

Configure these for Production. Add Preview equivalents when preview deploys need real integrations.

| Variable | Visibility | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_WEB_URL` | Browser | Production app URL, for example `https://app.example.com`. |
| `NEXT_PUBLIC_SITE_URL` | Browser | Same as production app URL unless a custom canonical URL differs. |
| `NEXT_PUBLIC_APP_URL` | Browser | Used by invitation routes. |
| `NEXT_PUBLIC_API_URL` | Browser | Usually `https://app.example.com/api`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key. Never expose client-side. |
| `OPENROUTER_API_KEY` | Server only | AI content generation key. |
| `SILICONFLOW_API_KEY` | Server only | Audio transcription key. |
| `SILICONFLOW_MODEL` | Server only | Defaults to `FunAudioLLM/SenseVoiceSmall`. |
| `STRIPE_SECRET_KEY` | Server only | Stripe payment secret key. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser | Stripe publishable key. |
| `ADMIN_CRON_SECRET` | Server only | Shared secret for protected scheduled admin routes. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Browser | Optional Google OAuth client id. |
| `NEXT_PUBLIC_ANALYTICS_ID` | Browser | Optional analytics id. |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser | Optional public Sentry DSN. |
| `SENTRY_DSN` | Server only | Optional server Sentry DSN. |

## Supabase Setup

The Supabase CLI project config lives in `supabase/config.toml`.

Production migrations live in `supabase/migrations/`:

1. `20260611000000_agent_phase1.sql`
2. `20260612000000_agent_phase2_public_archive.sql`
3. `20260621000000_storage_policies.sql`

For a manual dry run from a machine with Supabase CLI installed:

```bash
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push --linked --dry-run
```

For a manual production migration:

```bash
supabase db push --linked
```

The current migrations assume the base Saga schema already exists in Supabase. They add the agent tables, public archive tables, and storage policies used by the current app.

## Supabase Auth Redirects

Configure Supabase Auth URLs in `Authentication > URL Configuration`.

Set Site URL to the production app URL:

```text
https://app.example.com
```

Add redirect URLs for every supported locale:

```text
https://app.example.com/en/auth/callback
https://app.example.com/zh-CN/auth/callback
https://app.example.com/zh-TW/auth/callback
https://app.example.com/ja/auth/callback
https://app.example.com/ko/auth/callback
https://app.example.com/es/auth/callback
https://app.example.com/fr/auth/callback
https://app.example.com/pt/auth/callback
```

Add preview URL patterns only if preview deployments need OAuth or magic-link testing.

## Verification

Before pushing infrastructure changes:

```bash
npm run test:infra
npm run verify
```

After GitHub Actions deploys production:

1. Open the GitHub Actions run and confirm `ci`, `supabase-production`, and `vercel-production` passed.
2. Open the Vercel production deployment URL.
3. Check `/api/health`.
4. Sign in through Supabase auth.
5. Create or open a project and confirm story/project reads still work.
6. In Supabase, check that the migration history includes the latest files from `supabase/migrations/`.

## Rollback

If Vercel deploy fails, no production deployment should be promoted. Fix the failure and push a new commit.

If Supabase migration fails, Vercel production deploy is blocked because `vercel-production` depends on `supabase-production`.

If a migration succeeds but the app has a production regression:

1. Use Vercel dashboard to promote the previous successful deployment.
2. Do not manually edit production schema unless the migration introduced a data or constraint issue.
3. Write a forward-fix migration and push through GitHub Actions.

## References

- [Vercel GitHub Actions guide](https://vercel.com/guides/how-can-i-use-github-actions-with-vercel)
- [Supabase CLI db push reference](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Supabase CLI link reference](https://supabase.com/docs/reference/cli/supabase-link)
