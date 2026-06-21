# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

UR Saga is an AI-powered family biography platform ("Your Origin") for intergenerational storytelling. Seniors record audio stories via a frictionless web (PWA) experience; AI agents transcribe, structure, and curate them into a private biography, with an opt-in path to an anonymized public collective archive. The authoritative product spec is `UR saga v1.8.md` at the repo root.

## Commands

All commands run from the repo root unless noted. This is an npm workspaces monorepo.

```bash
npm run dev              # Start the Next.js web app (packages/web)
npm run build:vercel     # Build shared then web (the production/Vercel build)
npm run lint             # ESLint across workspaces
npm run lint:fix
npm run type-check       # tsc --noEmit across workspaces
npm run verify           # type-check + lint + web tests (--runInBand) + build:vercel - run before considering work done
```

Tests (Jest) live in the web and shared packages:

```bash
# Web (jest + next/jest, jsdom)
npm test --workspace=packages/web                          # all web tests
npm test --workspace=packages/web -- path/to/file.test.ts  # single file
npm test --workspace=packages/web -- -t "test name"        # by test name

# Shared (ts-jest)
npm test --workspace=packages/shared
```

`npm run verify` is the gate the project uses; prefer it over running pieces ad hoc when wrapping up.

## Architecture

### Monorepo layout
- `packages/shared` (`@saga/shared`) - framework-agnostic types, AI prompts, permissions, service plans. **Must be built (`tsc`) before the web app**; `build:web`/`build:vercel` do this automatically. The web app also `transpilePackages: ['@saga/shared']` and aliases `@saga/shared/*` directly to `../shared/src/*` (see `packages/web/tsconfig.json`), so source changes are picked up in dev without a rebuild.
- `packages/web` (`@saga/web`) - the Next.js 16 (App Router, React 19) application. This is where nearly all work happens.
- `_archive_backend` - **legacy, not active.** A former Express/Knex backend, archived (see commit `1fb80824b`). The app no longer has a separate API server; it talks to Supabase directly. Do not add features here.
- `src/app/dashboard/purchase/page.tsx` at the repo root is a stray leftover; the real app lives under `packages/web/src/app`.

### Data & backend model
There is **no custom backend server**. Persistence, auth, and storage are all Supabase:
- `packages/web/src/lib/supabase.ts` - client factories. `createClientSupabase()` is a browser singleton with a stub fallback when env vars are missing (so local preview doesn't crash). `getSupabaseAdmin()` provides the service-role client for server code.
- Server-side auth is centralized in `packages/web/src/lib/server/auth.ts` via `getAuthenticatedUser(request)` (accepts a Bearer token or SSR cookies). API routes call it first and thread the returned `headers` back into responses.
- Project-scoped authorization goes through `packages/web/src/lib/server/project-access.ts` (`requireProjectAccess`). Permissions logic is shared in `@saga/shared/lib/permissions`.
- Database schema is applied via SQL files in `packages/web/supabase/` (`agent-phase1.sql`, `agent-phase2-public-archive.sql`, `storage-policies.sql`) - **not** a migrations framework. `supabase/config.toml` at root configures the local Supabase CLI.

### API layer
- API routes are Next.js Route Handlers under `packages/web/src/app/api/**/route.ts` (e.g. `api/agents`, `api/ai`, `api/payments`, `api/stories`). Standard pattern: authenticate -> validate input -> check project access -> do work -> return `NextResponse.json(..., { headers: auth.headers })`.
- The client-side API surface is `packages/web/src/lib/api.ts` (`ApiClient`), which delegates to `api-http.ts` (HTTP calls) and `api-supabase.ts` (direct Supabase calls). Treat `lib/api.ts` as the stable facade; older code referenced a "mixed mode" that has been collapsed onto Supabase.
- Client services attach auth via `useAuthStore.getState().getAccessToken()` (see `ai-service.ts` for the pattern).

### Agent system (core differentiator)
The product is built around AI agents over recorded stories. Pure agent logic is separated from I/O:
- `packages/web/src/lib/agents/` - **pure functions**, no I/O: `interview-agent.ts` (host-style prompting / intervention levels Off/Low/High), `editor-agent.ts` (`processStoryForBiography` turns a transcript into a standalone story + structured `StoryElement`s).
- `packages/web/src/lib/server/agent-store.ts` - persistence for agent runs/artifacts (`createAgentRun`, `completeAgentRun`, `createStoryElements`, etc.). Runs are deduplicated by content hash (`server/story-content-hash.ts`).
- `packages/web/src/lib/agent-service.ts` - client-facing request/response types and calls into the agent API routes.
- `packages/web/src/lib/public-archive/anonymizer.ts` - Phase 2 anonymization of opt-in public contributions.
- Shared agent types live in `@saga/shared/types/agents` and `@saga/shared/types/public-archive`.

Phasing matters: Phase 1 = private biography loop (Interview + Editor/Librarian agents, durable artifacts/elements). Phase 2 = opt-in anonymized public archive + Wiki Editor Agent (candidate -> draft events, reviewer approval). Design/plan docs are in `docs/superpowers/specs/` and `docs/superpowers/plans/` - read the relevant one before touching agent or public-archive features, and keep family sharing / story visibility / public-archive contribution as **separate concepts** (do not overload `stories.is_public`).

### Frontend
- App Router with i18n: all pages live under `app/[locale]/`. Locales are defined in `src/i18n/config.ts` (`en`, `zh-CN`, `zh-TW`, `ja`, `ko`, `es`, `fr`, `pt`); `localePrefix: 'always'`. `middleware.ts` runs `next-intl` middleware and also repairs malformed Supabase auth redirect URLs.
- State: Zustand stores in `src/stores/` (`auth-store`, `project-store`, `export-store`).
- UI: Tailwind CSS + Radix primitives + `class-variance-authority`; design tokens in `src/lib/design-tokens.ts` / `design-system.ts`.
- Payments: Stripe (`src/lib/payments`, `src/services/stripe.service.ts`, `subscription.service.ts`). Service/plan definitions are in `@saga/shared/config/service-plans`.
- Audio recording is browser-based (`MediaRecorder` chunked uploads, Screen Wake Lock); transcription/AI via OpenAI (`src/lib/ai-service.ts`, `api/ai`).

## Conventions
- Path alias `@/*` -> `packages/web/src/*` (mirrored in `jest.config.js` and `tsconfig.json`). The jest config also remaps a few legacy non-locale dashboard paths to their `[locale]` equivalents.
- Keep agent business logic pure and unit-testable; put Supabase/network I/O in `lib/server/*`, `lib/api*`, or route handlers.
- Tests sit in `__tests__/` directories next to the code they cover.
- Some Chinese comments appear in older infrastructure files (e.g. `lib/api.ts`); match the surrounding language when editing those files.
- Builds do **not** ignore type or lint errors (`next.config.js` sets both to fail the build), so `type-check` and `lint` must be clean.
