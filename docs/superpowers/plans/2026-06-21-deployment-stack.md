# Deployment Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the GitHub Actions, Vercel auto-deployment, and Supabase database deployment stack for the Saga monorepo.

**Architecture:** Keep Vercel as the web runtime, Supabase as the database/auth/storage backend, and GitHub Actions as the CI/CD controller. The workflow validates pull requests, deploys Vercel previews from pull requests, applies Supabase migrations only from `main`, then deploys the production Vercel build.

**Tech Stack:** GitHub Actions, Vercel CLI, Supabase CLI, npm workspaces, Node.js test runner, Next.js, Supabase SQL migrations.

---

### Task 1: Add Infra Configuration Tests

**Files:**
- Create: `scripts/__tests__/deployment-config.test.js`
- Modify: `package.json`

- [ ] Add a Node test runner suite that parses `.github/workflows/deploy.yml`, `packages/web/vercel.json`, Supabase migrations, and env example files.
- [ ] Add `npm run test:infra` to execute the suite.
- [ ] Verify the test fails against the current workflow because deployment jobs, migrations, and env templates are incomplete.

### Task 2: Replace GitHub Actions Workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] Keep PR and main CI gates on `npm ci`, `npm run test:infra`, `npm run type-check`, `npm run lint`, and web Jest.
- [ ] Add Vercel preview deployment for pull requests using `vercel pull`, `vercel build`, and `vercel deploy --prebuilt`.
- [ ] Add production Supabase migration job on `main` using `supabase db push --linked`.
- [ ] Add production Vercel deployment on `main` after CI and Supabase migrations pass.

### Task 3: Register Supabase Migrations

**Files:**
- Create: `supabase/migrations/20260611000000_agent_phase1.sql`
- Create: `supabase/migrations/20260612000000_agent_phase2_public_archive.sql`
- Create: `supabase/migrations/20260621000000_storage_policies.sql`

- [ ] Copy the existing SQL from `packages/web/supabase/` into Supabase CLI migration files in dependency order.
- [ ] Preserve the original SQL files as developer-readable references and test fixtures.

### Task 4: Harden Env and Vercel Config

**Files:**
- Modify: `packages/web/.env.example`
- Modify: `.env.production.example`
- Modify: `packages/web/vercel.json`
- Create: `docs/deployment/github-vercel-supabase.md`

- [ ] Replace real-looking keys in env examples with placeholders that document purpose and scope.
- [ ] Add Vercel cron configuration for invitation cleanup.
- [ ] Document required GitHub secrets, Vercel env vars, Supabase migration commands, and rollback checks.

### Task 5: Verify

**Files:**
- No new files.

- [ ] Run `npm run test:infra`.
- [ ] Run `npm run verify`.
- [ ] Report exact pass/fail evidence and any manual UI steps still required.
