# Saga Stabilization And Branch Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Saga to a releaseable baseline by re-enabling quality gates, fixing the highest-risk security defects, aligning the V1.8 audio path, and cleaning legacy branch/repo state without losing current work.

**Architecture:** Keep the Next.js web app as the only active runtime and treat the archived backend as historical source only. Add small server-only guard modules for auth, project access, rate limiting, and payment catalog ownership, then wire API routes through those modules. Repair the API client contract before broad UI cleanup so TypeScript, lint, and tests expose real product defects instead of migration fallout.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Supabase Auth/Storage/Postgres, Stripe, Jest 30, next/jest, Git worktrees.

---

## Current Evidence

- `npm run type-check --workspace=packages/shared` passes.
- `npm run type-check --workspace=packages/web -- --pretty false` fails with 386 TypeScript errors.
- `npm run lint --workspace=packages/web` fails on `packages/web/src/components/stories/chapter-summary-card.tsx` undefined icons and one a11y warning.
- `npm test --workspace=packages/web -- --runInBand --silent` fails: 14 failed suites, 2 passed suites, 110 failed tests.
- `npm run build --workspace=packages/web` exits 0 only because `packages/web/next.config.js` skips type validation and linting.
- `npm audit --workspaces --audit-level=moderate --json` reports 34 vulnerabilities: 3 critical, 15 high.
- `git status --short` currently shows 38 modified files, 8144 deleted tracked files, and 8 untracked paths. Most deleted files are tracked `packages/backend` content including `node_modules`.
- `main` is ahead of `origin/main` by 2 docs commits: `0bec8be07` and `b1e00274f`.

## File Structure

### New Files

- `docs/maintenance/2026-04-30-branch-inventory.md` records branch decisions before local/remote cleanup.
- `packages/web/src/lib/server/auth.ts` centralizes route auth from Bearer token and Supabase cookies.
- `packages/web/src/lib/server/rate-limit.ts` provides a deterministic in-memory limiter for immediate API protection.
- `packages/web/src/lib/server/project-access.ts` checks project owner/member access when a route has `projectId`.
- `packages/web/src/lib/server/ai-guard.ts` composes auth, size checks, and rate limit response headers for AI routes.
- `packages/web/src/lib/server/cron.ts` validates admin cron calls using `ADMIN_CRON_SECRET`.
- `packages/web/src/lib/payments/catalog.ts` stores package IDs, server-owned prices in cents, and Stripe metadata.
- `packages/web/src/lib/api-http.ts` provides typed `get/post/put/delete` fetch helpers for legacy services that still call REST routes.
- `packages/web/src/app/api/media/signed-url/route.ts` returns short-lived signed URLs for private media playback.
- `packages/web/src/__tests__/config-gates.test.ts` prevents disabling Next build gates again.
- `packages/web/src/lib/server/__tests__/rate-limit.test.ts` proves limiter behavior.
- `packages/web/src/lib/payments/__tests__/catalog.test.ts` proves package price lookup and invalid package rejection.
- `packages/web/src/app/api/admin/cleanup-invitations/__tests__/route.test.ts` proves cron secret enforcement.
- `packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx` proves the V1.8 record path uses `SmartRecorder`.

### Modified Files

- `.github/workflows/deploy.yml` runs type-check, lint, test, build, and audit before deploy.
- `.gitignore` ignores generated SQLite files, local test output, and archive dependency folders.
- `package.json` adds root verification scripts.
- `packages/web/next.config.js` stops ignoring TypeScript and lint errors.
- `packages/web/jest.config.js` maps locale-less legacy imports and transforms `next-intl` ESM dependencies.
- `packages/web/jest.setup.js` mocks Next navigation and browser APIs used by tests.
- `packages/web/src/lib/api.ts` exposes `get/post/put/delete` by delegating to `packages/web/src/lib/api-http.ts`.
- `packages/web/src/app/api/ai/generate-content/route.ts` requires auth and user-level rate limit.
- `packages/web/src/app/api/ai/process-stories/route.ts` requires auth and user-level rate limit.
- `packages/web/src/app/api/ai/transcribe/route.ts` requires auth, rate limit, and a concrete audio size cap.
- `packages/web/src/app/api/ai/realtime-prompt/route.ts` requires auth and tighter rate limit.
- `packages/web/src/app/api/admin/cleanup-invitations/route.ts` requires `ADMIN_CRON_SECRET`.
- `packages/web/src/app/api/payments/create-intent/route.ts` derives amount/currency from server catalog.
- `packages/web/src/services/stripe.service.ts` sends only `packageId` and metadata to create PaymentIntent.
- `packages/web/src/components/purchase/pricing-cards.tsx` imports package prices from the server-owned catalog shape or mirrors the same IDs.
- `packages/web/src/components/stories/chapter-summary-card.tsx` removes the duplicate export and uses the canonical shared `ChapterSummary` fields.
- `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx` uses `SmartRecorder` on the main recording path.
- `packages/web/src/lib/storage.ts` returns storage paths and uses signed URLs for private media.
- `packages/web/src/lib/stories.ts` stops returning public URLs for family audio.
- `package-lock.json` updates after dependency/security changes.
- `docker-compose.yml` and `docker-compose.production.yml` stop referencing the removed active backend service.

---

## Phase 0: Git Safety And Historical Branch Cleanup

### Task 0.1: Preserve Current Work And Start An Isolated Worktree

**Files:**
- Create: `/tmp/saga-audit-before.status`
- Create: `/tmp/saga-audit-before.patch`
- Create: `/tmp/saga-main-ahead-2026-04-30.bundle`
- Create branch: `codex/preserve-main-ahead-2026-04-30`
- Create worktree branch: `codex/saga-stabilization-and-branch-cleanup`

- [ ] **Step 1: Capture current dirty state**

```bash
git status -sb
git status --short > /tmp/saga-audit-before.status
git diff -- . ':!packages/backend/node_modules' > /tmp/saga-audit-before.patch
```

Expected: `/tmp/saga-audit-before.status` contains current modified/deleted/untracked files; `/tmp/saga-audit-before.patch` contains only non-`node_modules` content changes.

- [ ] **Step 2: Preserve the current ahead-of-origin main state**

```bash
git branch codex/preserve-main-ahead-2026-04-30 main
git bundle create /tmp/saga-main-ahead-2026-04-30.bundle origin/main..main
git log --oneline origin/main..main
```

Expected output includes:

```text
b1e00274f docs: add friend handoff implementation plan
0bec8be07 docs: add friend handoff design spec
```

- [ ] **Step 3: Create a clean implementation worktree from `origin/main`**

```bash
git fetch --prune origin
git worktree add -b codex/saga-stabilization-and-branch-cleanup ../saga-stabilization origin/main
cd ../saga-stabilization
git status -sb
```

Expected: new worktree is on `codex/saga-stabilization-and-branch-cleanup` with a clean status.

- [ ] **Step 4: Commit only this plan in the original repo if it is not already committed**

Run this from `/Users/eat/Documents/eatpotato/saga传奇`:

```bash
git add docs/superpowers/plans/2026-04-30-saga-stabilization-and-branch-cleanup.md
git commit -m "docs: add saga stabilization implementation plan"
```

Expected: one docs commit, no business code staged.

### Task 0.2: Record Branch Inventory Before Deleting Anything

**Files:**
- Create: `docs/maintenance/2026-04-30-branch-inventory.md`

- [ ] **Step 1: Create the maintenance folder**

```bash
mkdir -p docs/maintenance
```

- [ ] **Step 2: Write branch inventory**

Create `docs/maintenance/2026-04-30-branch-inventory.md` with this exact content after replacing only the command output blocks with local output:

````markdown
# Branch Inventory 2026-04-30

## Protected References

- `main`: local branch was ahead of `origin/main` by docs commits on 2026-04-30.
- `codex/preserve-main-ahead-2026-04-30`: safety copy of local `main` before stabilization.
- `/tmp/saga-main-ahead-2026-04-30.bundle`: offline recovery bundle for commits ahead of `origin/main`.

## Local Branches Observed

```text
  feature/story-image-upload                           e9a350a2c [origin/feature/story-image-upload] feat(images): implement story & interaction image upload with thumbnails, watermark, i18n metadata; add GET interaction images; use thumbnails in UI; supabase image domains; db migration for thumbnail/description/copyright
  fix-deployment-clean                                 1f5aacaf2 fix: UI improvements - fix pending followups count, move record story button, remove all projects button
  hotfix/active-transcript-highlight                   69e032e79 [origin/hotfix/active-transcript-highlight] fix(images): correct active transcript highlighting and reorder payload
* main                                                 b1e00274f [origin/main: ahead 2] docs: add friend handoff implementation plan
  remotes/origin/feat-add-internationalization-support ab09104ff fix: resolve final deployment failure by correcting dependencies
  remotes/origin/feature/story-image-upload            e9a350a2c feat(images): implement story & interaction image upload with thumbnails, watermark, i18n metadata; add GET interaction images; use thumbnails in UI; supabase image domains; db migration for thumbnail/description/copyright
  remotes/origin/hotfix/active-transcript-highlight    69e032e79 fix(images): correct active transcript highlighting and reorder payload
  remotes/origin/main                                  2b668b726 fix: close button
```

## Deletion Decisions

- Keep `main` until stabilization PR merges.
- Keep `codex/preserve-main-ahead-2026-04-30` until the two docs commits are pushed or intentionally abandoned.
- Keep `codex/saga-stabilization-and-branch-cleanup` as the active remediation branch.
- Delete `feature/story-image-upload`, `hotfix/active-transcript-highlight`, or `fix-deployment-clean` only when the matching `git merge-base --is-ancestor BRANCH origin/main` command exits 0.
- Delete a remote feature or hotfix branch only after confirming there is no open PR and its content has landed or is intentionally abandoned.
````

- [ ] **Step 3: Fill the branch output block**

```bash
git branch -vv --all --no-color
```

Expected: the document includes `feature/story-image-upload`, `fix-deployment-clean`, `hotfix/active-transcript-highlight`, `origin/feat-add-internationalization-support`, `origin/feature/story-image-upload`, and `origin/hotfix/active-transcript-highlight`.

- [ ] **Step 4: Commit the branch inventory**

```bash
git add docs/maintenance/2026-04-30-branch-inventory.md
git commit -m "docs: record branch cleanup inventory"
```

Expected: one docs commit.

### Task 0.3: Archive Or Remove The Legacy Backend Without Tracking Dependencies

**Files:**
- Modify: `.gitignore`
- Move tracked source from: `packages/backend/`
- Create or modify: `_archive_backend/`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.production.yml`

- [ ] **Step 1: Add archive and generated-file ignores**

Modify `.gitignore` to include:

```gitignore

# generated local databases
*.sqlite
*.sqlite3

# archived backend dependency folders stay local only
_archive_backend/node_modules
_archive_backend/**/node_modules

# local audit outputs
tsc_output.txt
```

- [ ] **Step 2: Move backend source into `_archive_backend`**

Run from the clean worktree:

```bash
mkdir -p _archive_backend
git mv packages/backend/.env.example _archive_backend/.env.example
git mv packages/backend/Dockerfile _archive_backend/Dockerfile
git mv packages/backend/knexfile.js _archive_backend/knexfile.js
git mv packages/backend/migrations _archive_backend/migrations
git mv packages/backend/seeds _archive_backend/seeds
git mv packages/backend/src _archive_backend/src
git mv packages/backend/tsconfig.json _archive_backend/tsconfig.json
git mv packages/backend/package.json _archive_backend/package.json
git rm -r packages/backend/node_modules
git rm packages/backend/dev.sqlite3 packages/backend/package-lock.json
rmdir packages/backend
```

Expected: `git status --short` shows `_archive_backend` files as renamed or added, `packages/backend/node_modules` as removed, and no tracked `node_modules` under `_archive_backend`.

- [ ] **Step 3: Remove backend services from Docker Compose**

In `docker-compose.yml` and `docker-compose.production.yml`, remove service blocks that reference `packages/backend`, backend ports, or backend build contexts. Keep web and shared services unchanged.

Run:

```bash
rg -n "packages/backend|backend|dev.sqlite3" docker-compose.yml docker-compose.production.yml
```

Expected: no output.

- [ ] **Step 4: Verify no dependency directory is tracked**

```bash
git ls-files | rg '(^|/)node_modules/'
```

Expected: no output.

- [ ] **Step 5: Commit backend archive cleanup**

```bash
git add .gitignore _archive_backend docker-compose.yml docker-compose.production.yml
git add -u packages/backend
git commit -m "chore: archive legacy backend without tracked dependencies"
```

Expected: one cleanup commit; `git status --short` no longer lists thousands of backend `node_modules` deletions.

---

## Phase 1: Restore Release Gates

### Task 1.1: Re-enable Next Build Validation

**Files:**
- Modify: `packages/web/next.config.js`
- Test: `packages/web/src/__tests__/config-gates.test.ts`

- [ ] **Step 1: Write a failing config gate test**

Create `packages/web/src/__tests__/config-gates.test.ts`:

```ts
const nextConfig = require('../../next.config.js')

describe('Next release gates', () => {
  it('does not ignore TypeScript build errors', () => {
    expect(nextConfig.typescript?.ignoreBuildErrors).not.toBe(true)
  })

  it('does not ignore ESLint during builds', () => {
    expect(nextConfig.eslint?.ignoreDuringBuilds).not.toBe(true)
  })
})
```

- [ ] **Step 2: Run the failing test**

```bash
npm test --workspace=packages/web -- src/__tests__/config-gates.test.ts --runInBand
```

Expected: FAIL because `ignoreBuildErrors` and `ignoreDuringBuilds` are currently `true`.

- [ ] **Step 3: Modify `packages/web/next.config.js`**

Replace:

```js
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
```

With:

```js
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
```

- [ ] **Step 4: Run the config gate test**

```bash
npm test --workspace=packages/web -- src/__tests__/config-gates.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/next.config.js packages/web/src/__tests__/config-gates.test.ts
git commit -m "chore: re-enable Next release gates"
```

### Task 1.2: Restore CI Quality Checks

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `package.json`

- [ ] **Step 1: Add root verification scripts**

Modify root `package.json` scripts to include:

```json
{
  "scripts": {
    "verify": "npm run type-check && npm run lint && npm test --workspace=packages/web -- --runInBand && npm run build:vercel",
    "audit:moderate": "npm audit --workspaces --audit-level=moderate"
  }
}
```

Keep existing scripts and add only the two new keys.

- [ ] **Step 2: Replace the disabled CI checks**

In `.github/workflows/deploy.yml`, replace the commented TypeScript/lint section with:

```yaml
      - name: Type check
        run: npm run type-check

      - name: Lint check
        run: npm run lint

      - name: Unit tests
        run: npm test --workspace=packages/web -- --runInBand

      - name: Dependency audit
        run: npm run audit:moderate
```

- [ ] **Step 3: Pass required server env into build**

In the `Build application` step, extend `env`:

```yaml
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          SILICONFLOW_API_KEY: ${{ secrets.SILICONFLOW_API_KEY }}
          ADMIN_CRON_SECRET: ${{ secrets.ADMIN_CRON_SECRET }}
```

- [ ] **Step 4: Validate workflow YAML shape**

```bash
node -e "const fs=require('fs'); const y=fs.readFileSync('.github/workflows/deploy.yml','utf8'); for (const s of ['Type check','Lint check','Unit tests','Dependency audit','SUPABASE_SERVICE_ROLE_KEY']) { if (!y.includes(s)) throw new Error('missing '+s) }"
```

Expected: command exits 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml package.json
git commit -m "ci: restore quality gates before deploy"
```

---

## Phase 2: Secure Server Routes

### Task 2.1: Add Shared Auth And Rate Limit Guards

**Files:**
- Create: `packages/web/src/lib/server/auth.ts`
- Create: `packages/web/src/lib/server/rate-limit.ts`
- Create: `packages/web/src/lib/server/project-access.ts`
- Create: `packages/web/src/lib/server/ai-guard.ts`
- Test: `packages/web/src/lib/server/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Write rate limit tests**

Create `packages/web/src/lib/server/__tests__/rate-limit.test.ts`:

```ts
import { createFixedWindowLimiter } from '../rate-limit'

describe('createFixedWindowLimiter', () => {
  it('allows requests before the limit and blocks after the limit', () => {
    const limiter = createFixedWindowLimiter({ max: 2, windowMs: 60_000, now: () => 1_000 })

    expect(limiter.check('user-1')).toMatchObject({ allowed: true, remaining: 1 })
    expect(limiter.check('user-1')).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.check('user-1')).toMatchObject({ allowed: false, remaining: 0 })
  })

  it('resets after the window expires', () => {
    let now = 1_000
    const limiter = createFixedWindowLimiter({ max: 1, windowMs: 10_000, now: () => now })

    expect(limiter.check('user-1').allowed).toBe(true)
    expect(limiter.check('user-1').allowed).toBe(false)

    now = 12_000
    expect(limiter.check('user-1')).toMatchObject({ allowed: true, remaining: 0 })
  })
})
```

- [ ] **Step 2: Run the failing test**

```bash
npm test --workspace=packages/web -- src/lib/server/__tests__/rate-limit.test.ts --runInBand
```

Expected: FAIL because `../rate-limit` does not exist.

- [ ] **Step 3: Create `packages/web/src/lib/server/rate-limit.ts`**

```ts
export interface FixedWindowLimiterOptions {
  max: number
  windowMs: number
  now?: () => number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

interface Bucket {
  count: number
  resetAt: number
}

export function createFixedWindowLimiter(options: FixedWindowLimiterOptions) {
  const buckets = new Map<string, Bucket>()
  const now = options.now ?? (() => Date.now())

  return {
    check(key: string): RateLimitResult {
      const current = now()
      const existing = buckets.get(key)
      const bucket =
        existing && existing.resetAt > current
          ? existing
          : { count: 0, resetAt: current + options.windowMs }

      bucket.count += 1
      buckets.set(key, bucket)

      const remaining = Math.max(options.max - bucket.count, 0)

      return {
        allowed: bucket.count <= options.max,
        remaining,
        resetAt: bucket.resetAt,
        limit: options.max,
      }
    },
  }
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
}
```

- [ ] **Step 4: Create `packages/web/src/lib/server/auth.ts`**

```ts
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getSupabaseAdmin } from '@/lib/supabase'

export interface AuthenticatedUser {
  user: User
}

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    throw new Error('Supabase public environment variables are required')
  }

  return { url, anonKey }
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (bearer) {
    const { data, error } = await getSupabaseAdmin().auth.getUser(bearer)
    if (!error && data.user) return { ok: true, user: data.user }
  }

  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (!error && data.user) return { ok: true, user: data.user }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}
```

- [ ] **Step 5: Create `packages/web/src/lib/server/project-access.ts`**

```ts
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'

export type ProjectAccessResult =
  | { ok: true }
  | { ok: false; response: NextResponse }

export async function requireProjectAccess(projectId: string, user: User): Promise<ProjectAccessResult> {
  const db = getSupabaseAdmin()

  const { data: project, error: projectError } = await db
    .from('projects')
    .select('id, facilitator_id')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError || !project) {
    return { ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }
  }

  if (project.facilitator_id === user.id) {
    return { ok: true }
  }

  const { data: role } = await db
    .from('project_roles')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!role) {
    return { ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  }

  return { ok: true }
}
```

- [ ] **Step 6: Create `packages/web/src/lib/server/ai-guard.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createFixedWindowLimiter, rateLimitHeaders } from './rate-limit'
import { getAuthenticatedUser } from './auth'

const aiLimiter = createFixedWindowLimiter({ max: 30, windowMs: 60 * 60 * 1000 })
const realtimeLimiter = createFixedWindowLimiter({ max: 120, windowMs: 60 * 60 * 1000 })

export type AiAction =
  | 'generate-content'
  | 'process-stories'
  | 'transcribe'
  | 'realtime-prompt'

export type AiGuardResult =
  | { ok: true; user: User; headers: HeadersInit }
  | { ok: false; response: NextResponse }

export async function requireAiRequest(request: NextRequest, action: AiAction): Promise<AiGuardResult> {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth

  const limiter = action === 'realtime-prompt' ? realtimeLimiter : aiLimiter
  const result = limiter.check(`${action}:${auth.user.id}`)
  const headers = rateLimitHeaders(result)

  if (!result.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers },
      ),
    }
  }

  return { ok: true, user: auth.user, headers }
}

export function jsonWithRateLimit(body: unknown, headers: HeadersInit, status = 200) {
  return NextResponse.json(body, { status, headers })
}
```

- [ ] **Step 7: Run rate limit tests**

```bash
npm test --workspace=packages/web -- src/lib/server/__tests__/rate-limit.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/lib/server
git commit -m "feat: add server auth and rate limit guards"
```

### Task 2.2: Guard AI Routes

**Files:**
- Modify: `packages/web/src/app/api/ai/generate-content/route.ts`
- Modify: `packages/web/src/app/api/ai/process-stories/route.ts`
- Modify: `packages/web/src/app/api/ai/transcribe/route.ts`
- Modify: `packages/web/src/app/api/ai/realtime-prompt/route.ts`

- [ ] **Step 1: Add guard imports to each AI route**

In each route file, add:

```ts
import { jsonWithRateLimit, requireAiRequest } from '@/lib/server/ai-guard'
```

- [ ] **Step 2: Add guard at the top of each POST handler**

Use the matching action string per file:

```ts
const guard = await requireAiRequest(request, 'generate-content')
if (!guard.ok) return guard.response
```

For `process-stories` use `'process-stories'`; for `transcribe` use `'transcribe'`; for `realtime-prompt` use `'realtime-prompt'`.

- [ ] **Step 3: Return rate-limit headers on successful JSON responses**

Replace successful returns like:

```ts
return NextResponse.json(result)
```

With:

```ts
return jsonWithRateLimit(result, guard.headers)
```

For responses that already set a custom status, use:

```ts
return jsonWithRateLimit({ error: 'No audio file provided' }, guard.headers, 400)
```

- [ ] **Step 4: Add audio size cap in `transcribe`**

In `packages/web/src/app/api/ai/transcribe/route.ts`, after reading `audioFile`, add:

```ts
const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024

if (audioFile.size > MAX_TRANSCRIBE_BYTES) {
  return jsonWithRateLimit(
    { error: 'Audio file too large. Maximum size is 25MB.' },
    guard.headers,
    413,
  )
}
```

- [ ] **Step 5: Restrict CORS preflight response**

In each AI route `OPTIONS`, replace `Access-Control-Allow-Origin: '*'` with:

```ts
const origin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'
```

And return:

```ts
headers: {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
```

- [ ] **Step 6: Run targeted type check**

```bash
npm run type-check --workspace=packages/web -- --pretty false
```

Expected at this stage: still fails because the repo has existing TypeScript debt, but there are no new errors from `src/lib/server` or `src/app/api/ai`.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/app/api/ai packages/web/src/lib/server/ai-guard.ts
git commit -m "fix: require auth and rate limits for AI routes"
```

### Task 2.3: Lock Down Admin Cleanup Endpoint

**Files:**
- Create: `packages/web/src/lib/server/cron.ts`
- Modify: `packages/web/src/app/api/admin/cleanup-invitations/route.ts`
- Test: `packages/web/src/app/api/admin/cleanup-invitations/__tests__/route.test.ts`

- [ ] **Step 1: Create cron secret helper**

Create `packages/web/src/lib/server/cron.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

export type CronSecretResult =
  | { ok: true }
  | { ok: false; response: NextResponse }

export function requireCronSecret(request: NextRequest): CronSecretResult {
  const expected = process.env.ADMIN_CRON_SECRET
  const provided = request.headers.get('x-cron-secret')

  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin cron secret is not configured' }, { status: 503 }),
    }
  }

  if (provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { ok: true }
}
```

- [ ] **Step 2: Write route auth tests**

Create `packages/web/src/app/api/admin/cleanup-invitations/__tests__/route.test.ts`:

```ts
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    rpc: jest.fn(),
    from: jest.fn(),
  })),
}))

describe('/api/admin/cleanup-invitations', () => {
  const originalSecret = process.env.ADMIN_CRON_SECRET

  afterEach(() => {
    process.env.ADMIN_CRON_SECRET = originalSecret
  })

  it('rejects POST without x-cron-secret', async () => {
    process.env.ADMIN_CRON_SECRET = 'secret-1'
    const request = new NextRequest('http://localhost/api/admin/cleanup-invitations', { method: 'POST' })

    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('rejects GET without x-cron-secret', async () => {
    process.env.ADMIN_CRON_SECRET = 'secret-1'
    const request = new NextRequest('http://localhost/api/admin/cleanup-invitations', { method: 'GET' })

    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run the failing route test**

```bash
npm test --workspace=packages/web -- src/app/api/admin/cleanup-invitations/__tests__/route.test.ts --runInBand
```

Expected: FAIL because route does not require `x-cron-secret`.

- [ ] **Step 4: Add guard to both handlers**

At the start of `POST` and `GET` in `packages/web/src/app/api/admin/cleanup-invitations/route.ts`, add:

```ts
const cron = requireCronSecret(request)
if (!cron.ok) return cron.response
```

Also add:

```ts
import { requireCronSecret } from '@/lib/server/cron'
```

- [ ] **Step 5: Run route test**

```bash
npm test --workspace=packages/web -- src/app/api/admin/cleanup-invitations/__tests__/route.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/server/cron.ts packages/web/src/app/api/admin/cleanup-invitations
git commit -m "fix: protect admin cleanup endpoint with cron secret"
```

### Task 2.4: Make Payment Amount Server-Owned

**Files:**
- Create: `packages/web/src/lib/payments/catalog.ts`
- Test: `packages/web/src/lib/payments/__tests__/catalog.test.ts`
- Modify: `packages/web/src/app/api/payments/create-intent/route.ts`
- Modify: `packages/web/src/services/stripe.service.ts`
- Modify: `packages/web/src/components/payment/payment-form.tsx`

- [ ] **Step 1: Write catalog tests**

Create `packages/web/src/lib/payments/__tests__/catalog.test.ts`:

```ts
import { getPaymentPackage } from '../catalog'

describe('payment package catalog', () => {
  it('returns server-owned cents for starter package', () => {
    expect(getPaymentPackage('starter')).toMatchObject({
      id: 'starter',
      amount: 9900,
      currency: 'usd',
    })
  })

  it('returns null for unknown package IDs', () => {
    expect(getPaymentPackage('free-money')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the failing catalog test**

```bash
npm test --workspace=packages/web -- src/lib/payments/__tests__/catalog.test.ts --runInBand
```

Expected: FAIL because `../catalog` does not exist.

- [ ] **Step 3: Create `packages/web/src/lib/payments/catalog.ts`**

```ts
export interface PaymentPackage {
  id: 'starter' | 'family' | 'extended'
  name: string
  amount: number
  currency: 'usd'
  projectVouchers: number
  facilitatorSeats: number
  storytellerSeats: number
}

export const PAYMENT_PACKAGES: Record<PaymentPackage['id'], PaymentPackage> = {
  starter: {
    id: 'starter',
    name: 'Family Starter',
    amount: 9900,
    currency: 'usd',
    projectVouchers: 1,
    facilitatorSeats: 1,
    storytellerSeats: 2,
  },
  family: {
    id: 'family',
    name: 'The Family Saga',
    amount: 14900,
    currency: 'usd',
    projectVouchers: 1,
    facilitatorSeats: 2,
    storytellerSeats: 4,
  },
  extended: {
    id: 'extended',
    name: 'Extended Family',
    amount: 24900,
    currency: 'usd',
    projectVouchers: 2,
    facilitatorSeats: 4,
    storytellerSeats: 8,
  },
}

export function getPaymentPackage(packageId: string): PaymentPackage | null {
  return PAYMENT_PACKAGES[packageId as PaymentPackage['id']] ?? null
}
```

- [ ] **Step 4: Run catalog test**

```bash
npm test --workspace=packages/web -- src/lib/payments/__tests__/catalog.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Modify create-intent route**

In `packages/web/src/app/api/payments/create-intent/route.ts`, replace:

```ts
const { packageId, amount, currency = 'usd', metadata = {} } = body

if (!packageId || !amount || amount <= 0) {
  return NextResponse.json({ error: 'Invalid payment request' }, { status: 400 })
}
```

With:

```ts
const { packageId, metadata = {} } = body
const paymentPackage = getPaymentPackage(packageId)

if (!paymentPackage) {
  return NextResponse.json({ error: 'Invalid package' }, { status: 400 })
}
```

Add import:

```ts
import { getPaymentPackage } from '@/lib/payments/catalog'
```

Then replace Stripe creation amount/currency:

```ts
amount: paymentPackage.amount,
currency: paymentPackage.currency,
```

And metadata:

```ts
metadata: {
  packageId: paymentPackage.id,
  packageName: paymentPackage.name,
  userId: user.id,
  ...metadata,
},
```

- [ ] **Step 6: Modify Stripe service request type**

In `packages/web/src/services/stripe.service.ts`, change:

```ts
export interface CreatePaymentIntentRequest {
  packageId: string
  amount: number
  currency: string
  metadata?: Record<string, string>
}
```

To:

```ts
export interface CreatePaymentIntentRequest {
  packageId: string
  metadata?: Record<string, string>
}
```

In `packages/web/src/components/payment/payment-form.tsx`, replace the call payload:

```ts
const intent = await stripeService.createPaymentIntent({
  packageId,
  amount,
  currency,
})
```

With:

```ts
const intent = await stripeService.createPaymentIntent({
  packageId,
})
```

- [ ] **Step 7: Run payment-related type check**

```bash
npm run type-check --workspace=packages/web -- --pretty false
```

Expected at this stage: still fails elsewhere, but there are no errors in `src/lib/payments`, `src/app/api/payments/create-intent/route.ts`, `src/services/stripe.service.ts`, or `src/components/payment/payment-form.tsx`.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/lib/payments packages/web/src/app/api/payments/create-intent/route.ts packages/web/src/services/stripe.service.ts packages/web/src/components/payment/payment-form.tsx
git commit -m "fix: derive payment amounts from server catalog"
```

---

## Phase 3: Repair API Contract And Type Baseline

### Task 3.1: Restore Legacy REST Helpers While Supabase Migration Continues

**Files:**
- Create: `packages/web/src/lib/api-http.ts`
- Modify: `packages/web/src/lib/api.ts`
- Test: `packages/web/src/hooks/__tests__/use-search.test.ts`

- [ ] **Step 1: Create `packages/web/src/lib/api-http.ts`**

```ts
export interface ApiRequestOptions extends RequestInit {
  responseType?: 'json' | 'blob' | 'text'
}

export interface ApiResponse<T = unknown> {
  data: T
  status: number
}

async function request<T>(method: string, path: string, body?: unknown, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers)

  if (!(body instanceof FormData) && body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    ...options,
    method,
    credentials: options.credentials ?? 'include',
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `API request failed with ${response.status}`)
  }

  if (options.responseType === 'blob') {
    return { data: (await response.blob()) as T, status: response.status }
  }

  if (options.responseType === 'text') {
    return { data: (await response.text()) as T, status: response.status }
  }

  return { data: (await response.json()) as T, status: response.status }
}

export const httpApi = {
  get: <T = unknown>(path: string, options?: ApiRequestOptions) => request<T>('GET', path, undefined, options),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) => request<T>('POST', path, body, options),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) => request<T>('PUT', path, body, options),
  delete: <T = unknown>(path: string, options?: ApiRequestOptions) => request<T>('DELETE', path, undefined, options),
}
```

- [ ] **Step 2: Add methods to `ApiClient`**

In `packages/web/src/lib/api.ts`, import and expose `httpApi`:

```ts
import { httpApi, type ApiRequestOptions, type ApiResponse } from './api-http'
```

Inside `class ApiClient`, add before `auth = { ... }`:

```ts
get<T = unknown>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
  return httpApi.get<T>(path, options)
}

post<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
  return httpApi.post<T>(path, body, options)
}

put<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
  return httpApi.put<T>(path, body, options)
}

delete<T = unknown>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
  return httpApi.delete<T>(path, options)
}
```

- [ ] **Step 3: Run one previously failing API mock test**

```bash
npm test --workspace=packages/web -- src/hooks/__tests__/use-search.test.ts --runInBand
```

Expected: failures caused by `mockedApi.get` being undefined are gone. Remaining failures identify hook behavior or test setup drift.

- [ ] **Step 4: Run TypeScript and count remaining API method errors**

```bash
npm run type-check --workspace=packages/web -- --pretty false > /tmp/saga-tsc-after-api.out 2>&1 || true
rg "Property '(get|post|put|delete)' does not exist on type 'ApiClient'" /tmp/saga-tsc-after-api.out
```

Expected: no output from the `rg` command.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/api-http.ts packages/web/src/lib/api.ts
git commit -m "fix: restore REST helpers during API migration"
```

### Task 3.2: Fix Duplicate Chapter Summary Component

**Files:**
- Modify: `packages/web/src/components/stories/chapter-summary-card.tsx`

- [ ] **Step 1: Replace the file with one canonical component**

Use the shared `ChapterSummary` fields that exist in `packages/shared/src/types/chapter.ts`:

```tsx
'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import type { ChapterSummary } from '@saga/shared'
import { formatRelativeTime } from '@/lib/utils'

interface ChapterSummaryCardProps {
  chapter: ChapterSummary
  projectId: string
  onDelete?: (chapterId: string) => void
}

export function ChapterSummaryCard({ chapter, projectId, onDelete }: ChapterSummaryCardProps) {
  const locale = useLocale()
  const withLocale = (path: string) => `/${locale}${path}`

  return (
    <article className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Chapter Summary
          </p>
          <h3 className="text-lg font-semibold text-foreground">
            {chapter.chapter_id ? `Chapter ${chapter.chapter_id}` : 'Generated Summary'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {chapter.story_count} stories · {formatRelativeTime(chapter.created_at)}
          </p>
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(chapter.id)}
            className="rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        )}
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-card-foreground">
        {chapter.summary}
      </p>

      <div className="mt-5 border-t border-primary/10 pt-4">
        <Link
          href={withLocale(`/dashboard/projects/${projectId}/chapters/${chapter.id}`)}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          View Chapter
        </Link>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint --workspace=packages/web
```

Expected at this stage: the `PlayCircle`, `CheckCircle2`, and `MessageSquarePlus` lint errors are gone. The existing `story-search.tsx` a11y warning may remain until Task 3.3.

- [ ] **Step 3: Run TypeScript and check chapter file errors**

```bash
npm run type-check --workspace=packages/web -- --pretty false > /tmp/saga-tsc-after-chapter.out 2>&1 || true
rg "chapter-summary-card" /tmp/saga-tsc-after-chapter.out
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/stories/chapter-summary-card.tsx
git commit -m "fix: remove duplicate chapter summary component"
```

### Task 3.3: Fix The Known Lint A11y Warning

**Files:**
- Modify: `packages/web/src/components/search/story-search.tsx`

- [ ] **Step 1: Locate the invalid aria attribute**

```bash
nl -ba packages/web/src/components/search/story-search.tsx | sed -n '135,165p'
```

Expected: line around 149 has an `input` with `aria-expanded`.

- [ ] **Step 2: Move combobox attributes onto a wrapper**

Replace the input wrapper with this structure, preserving the existing state names and handlers:

```tsx
<div
  role="combobox"
  aria-expanded={showSuggestions}
  aria-haspopup="listbox"
  aria-owns="story-search-suggestions"
>
  <input
    type="search"
    value={query}
    onChange={handleQueryChange}
    aria-autocomplete="list"
    aria-controls="story-search-suggestions"
    className="w-full"
  />
</div>
```

If existing class names differ, keep the existing class names on the same elements.

- [ ] **Step 3: Ensure suggestions list has a matching id**

Set the suggestions container to:

```tsx
<ul id="story-search-suggestions" role="listbox">
```

- [ ] **Step 4: Run lint**

```bash
npm run lint --workspace=packages/web
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/search/story-search.tsx
git commit -m "fix: correct search combobox aria attributes"
```

---

## Phase 4: Repair Jest Baseline

### Task 4.1: Configure Jest For Next 15, Locale Routes, And Browser APIs

**Files:**
- Modify: `packages/web/jest.config.js`
- Modify: `packages/web/jest.setup.js`

- [ ] **Step 1: Update Jest config**

Replace `customJestConfig` in `packages/web/jest.config.js` with:

```js
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  transformIgnorePatterns: [
    '/node_modules/(?!next-intl|use-intl|intl-messageformat|@formatjs)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^../app/dashboard/page$': '<rootDir>/src/app/[locale]/dashboard/page',
    '^../app/dashboard/projects/new/page$': '<rootDir>/src/app/[locale]/dashboard/projects/create/page',
    '^../app/dashboard/projects/\\[id\\]/page$': '<rootDir>/src/app/[locale]/dashboard/projects/[id]/page',
  },
}
```

- [ ] **Step 2: Update Jest setup**

Replace `packages/web/jest.setup.js` with:

```js
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/en/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key) => key,
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: {
    getUserMedia: jest.fn(),
  },
})
```

- [ ] **Step 3: Run a previously ESM-failing test**

```bash
npm test --workspace=packages/web -- src/components/subscription/__tests__/subscription-overview.test.tsx --runInBand
```

Expected: failures caused by `Unexpected token 'export'` from `next-intl` are gone. Remaining failures identify component/test expectation drift.

- [ ] **Step 4: Run protected-route tests**

```bash
npm test --workspace=packages/web -- src/components/auth/__tests__/protected-route.test.tsx --runInBand
```

Expected: failures caused by `usePathname is not a function` are gone.

- [ ] **Step 5: Commit**

```bash
git add packages/web/jest.config.js packages/web/jest.setup.js
git commit -m "test: align Jest setup with Next app router"
```

### Task 4.2: Remove Node Test Runner Imports From Jest Tests

**Files:**
- Modify: `packages/web/src/stores/__tests__/auth-store.test.ts`

- [ ] **Step 1: Replace Node test imports**

Remove imports from `node:test`. The top of `packages/web/src/stores/__tests__/auth-store.test.ts` must use Jest globals only:

```ts
import { useAuthStore } from '../auth-store'
import { api } from '@/lib/api'
```

If the file imports `describe`, `it`, or `beforeEach` from `node:test`, delete those named imports.

- [ ] **Step 2: Run auth store test**

```bash
npm test --workspace=packages/web -- src/stores/__tests__/auth-store.test.ts --runInBand
```

Expected: the suite is discovered by Jest and no longer reports `Your test suite must contain at least one test`.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/stores/__tests__/auth-store.test.ts
git commit -m "test: use Jest globals in auth store tests"
```

### Task 4.3: Establish Passing Test Baseline

**Files:**
- Modify test files reported by the current run only when product behavior is already correct.
- Modify source files only when tests expose real broken behavior.

- [ ] **Step 1: Run the full test suite and save output**

```bash
npm test --workspace=packages/web -- --runInBand --silent > /tmp/saga-jest-baseline.out 2>&1 || true
rg "^FAIL|Tests:|Test Suites:" /tmp/saga-jest-baseline.out
```

Expected before fixes: fewer failures than the audited 14 failed suites / 110 failed tests.

- [ ] **Step 2: Fix `dataExportService` mock drift**

For tests that mock `@/services/data-export.service`, ensure the mock object includes these methods because production code calls them:

```ts
formatFileSize: jest.fn((bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}),
formatDuration: jest.fn((seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}),
getExportStructurePreview: jest.fn((projectName: string) => `${projectName}.zip
├── metadata.json
└── stories/
    └── [YYYY-MM-DD_Story-Title]/
        ├── audio.webm
        ├── transcript.txt
        ├── photo.jpg
        └── interactions.json`),
```

- [ ] **Step 3: Fix tests expecting old MediaRecorder constraints**

Where tests expect:

```ts
expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
  audio: true,
})
```

Replace with:

```ts
expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
  audio: expect.objectContaining({
    echoCancellation: true,
    noiseSuppression: true,
  }),
})
```

- [ ] **Step 4: Run full tests**

```bash
npm test --workspace=packages/web -- --runInBand --silent
```

Expected: PASS. If a failure remains, inspect that exact failure and either align the test with current intended behavior or fix the source defect before continuing.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "test: restore web test baseline"
```

---

## Phase 5: Align V1.8 Recording And Private Media Storage

### Task 5.1: Use SmartRecorder On The Main Record Page

**Files:**
- Modify: `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx`
- Test: `packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx`

- [ ] **Step 1: Write component integration test**

Create `packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'

jest.mock('@/components/recording/SmartRecorder', () => ({
  SmartRecorder: () => <div data-testid="smart-recorder" />,
}))

jest.mock('@/components/recording/DeepDiveRecorder', () => ({
  DeepDiveRecorder: () => <div data-testid="deep-dive-recorder" />,
}))

jest.mock('@/components/recording/ChatRecorder', () => ({
  ChatRecorder: () => <div data-testid="chat-recorder" />,
}))

describe('record page V1.8 recorder selection', () => {
  it('uses SmartRecorder on the main recording path', async () => {
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default

    render(
      // Params shape matches Next app router page props.
      <Page params={Promise.resolve({ locale: 'en', id: 'project-1' }) as any} />,
    )

    expect(await screen.findByTestId('smart-recorder')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the failing test**

```bash
npm test --workspace=packages/web -- src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx --runInBand
```

Expected: FAIL because the page imports and renders `DeepDiveRecorder` / `ChatRecorder`.

- [ ] **Step 3: Replace recorder imports**

In `record/page.tsx`, replace:

```ts
import { DeepDiveRecorder } from '@/components/recording/DeepDiveRecorder'
import { ChatRecorder } from '@/components/recording/ChatRecorder'
```

With:

```ts
import { SmartRecorder } from '@/components/recording/SmartRecorder'
```

- [ ] **Step 4: Replace the recording stage JSX**

Replace the `stage === 'recording'` branch contents with:

```tsx
{stage === 'recording' && (
  <div className="animate-in fade-in slide-in-from-bottom-4">
    <SmartRecorder
      promptText={currentPrompt.text}
      locale={locale}
      maxDuration={30 * 60}
      onRecordingComplete={(res) =>
        handleRecordingComplete({
          audioBlob: res.audioBlob,
          transcript: res.transcript,
          duration: res.duration,
        })
      }
      onError={(message) => {
        console.error('[record/page] recorder error:', message)
      }}
    />
  </div>
)}
```

- [ ] **Step 5: Run the recorder test**

```bash
npm test --workspace=packages/web -- src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx packages/web/src/components/recording/__tests__/record-page-uses-smart-recorder.test.tsx
git commit -m "feat: route main recording flow through SmartRecorder"
```

### Task 5.2: Return Signed URLs For Private Media

**Files:**
- Create: `packages/web/src/app/api/media/signed-url/route.ts`
- Modify: `packages/web/src/lib/storage.ts`
- Modify: `packages/web/src/lib/stories.ts`
- Modify: `packages/web/src/app/api/media/upload-image/route.ts`

- [ ] **Step 1: Create signed URL route**

Create `packages/web/src/app/api/media/signed-url/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/server/auth'

const ALLOWED_BUCKETS = new Set(['saga', 'audio-recordings'])

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const bucket = String(body.bucket || '')
  const path = String(body.path || '')
  const expiresIn = Number(body.expiresIn || 3600)

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'Unsupported bucket' }, { status: 400 })
  }

  if (!path.startsWith(`${auth.user.id}/`) && !path.includes(`/projects/`)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(bucket)
    .createSignedUrl(path, Math.min(Math.max(expiresIn, 60), 3600))

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl })
}
```

- [ ] **Step 2: Change image upload response names**

In `packages/web/src/app/api/media/upload-image/route.ts`, replace public URL response:

```ts
const { data: urlOriginal } = admin.storage.from('saga').getPublicUrl(uploadOriginal.path)
const { data: urlThumb }    = admin.storage.from('saga').getPublicUrl(uploadThumb.path)
```

With signed URL creation:

```ts
const { data: signedOriginal, error: signedOriginalError } = await admin.storage
  .from('saga')
  .createSignedUrl(uploadOriginal.path, 3600)
const { data: signedThumb, error: signedThumbError } = await admin.storage
  .from('saga')
  .createSignedUrl(uploadThumb.path, 3600)

if (signedOriginalError || signedThumbError || !signedOriginal || !signedThumb) {
  return NextResponse.json({ error: 'Failed to create signed image URL' }, { status: 500 })
}
```

Then return:

```ts
return NextResponse.json({
  success: true,
  url: signedOriginal.signedUrl,
  thumbUrl: signedThumb.signedUrl,
  path: uploadOriginal.path,
  thumbPath: uploadThumb.path,
})
```

- [ ] **Step 3: Change audio upload return shape**

In `packages/web/src/lib/stories.ts`, replace `getPublicUrl(data.path)` and `return urlData.publicUrl` with:

```ts
return data.path
```

Rename local variable usage from `audio_url` to `audio_path` only if the database schema has `audio_path`; if the schema still has `audio_url`, store the private path in that field and document the migration in `docs/maintenance/2026-04-30-branch-inventory.md` under "Storage Follow-up".

- [ ] **Step 4: Change storage service default URL semantics**

In `packages/web/src/lib/storage.ts`, keep returning `path` for uploads. Replace public URL creation:

```ts
const { data: urlData } = this.supabase.storage
  .from(bucket)
  .getPublicUrl(data.path)
```

With:

```ts
const urlData = { publicUrl: data.path }
```

And add a comment above the return:

```ts
// `url` is kept for legacy callers but now contains a private storage path.
```

- [ ] **Step 5: Run storage-related type check**

```bash
npm run type-check --workspace=packages/web -- --pretty false > /tmp/saga-tsc-after-storage.out 2>&1 || true
rg "uploadImageWithThumb|audio_url|audio_path|signed-url" /tmp/saga-tsc-after-storage.out
```

Expected: output is either empty or contains concrete call sites that must be updated in the same commit.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/app/api/media packages/web/src/lib/storage.ts packages/web/src/lib/stories.ts docs/maintenance/2026-04-30-branch-inventory.md
git commit -m "fix: use signed URLs for private media access"
```

---

## Phase 6: Dependency And Vulnerability Remediation

### Task 6.1: Upgrade Critical Runtime Dependencies

**Files:**
- Modify: `package.json`
- Modify: `packages/web/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Inspect current audit details**

```bash
npm audit --workspaces --audit-level=moderate --json > /tmp/saga-audit-before-fix.json || true
node -e "const j=require('/tmp/saga-audit-before-fix.json'); console.log(j.metadata.vulnerabilities); for (const [n,v] of Object.entries(j.vulnerabilities)) if (['critical','high'].includes(v.severity)) console.log(n, v.severity)"
```

Expected: shows `next`, `handlebars`, `protobufjs`, `axios`, `playwright`, `glob`, and related packages.

- [ ] **Step 2: Upgrade direct dependencies with security fixes**

Run:

```bash
npm install --workspace=packages/web next@latest eslint-config-next@latest axios@latest @playwright/test@latest playwright@latest
npm install --save-dev @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest
npm install --workspaces
```

Expected: `package-lock.json` updates and no workspace install error.

- [ ] **Step 3: Apply safe audit fixes**

```bash
npm audit fix --workspaces
```

Expected: lockfile changes only for semver-compatible vulnerability fixes.

- [ ] **Step 4: Re-run audit**

```bash
npm audit --workspaces --audit-level=moderate
```

Expected: no critical vulnerabilities. If moderate/high vulnerabilities remain in dev-only transitive packages, record the package chain and owner in `docs/maintenance/2026-04-30-branch-inventory.md` under "Dependency Follow-up".

- [ ] **Step 5: Commit**

```bash
git add package.json packages/web/package.json package-lock.json docs/maintenance/2026-04-30-branch-inventory.md
git commit -m "chore: upgrade vulnerable dependencies"
```

---

## Phase 7: Full Verification And Branch Pruning

### Task 7.1: Reach A Passing Release Baseline

**Files:**
- Modify only files necessary to satisfy the verification commands below.

- [ ] **Step 1: Run shared type-check**

```bash
npm run type-check --workspace=packages/shared
```

Expected: PASS.

- [ ] **Step 2: Run web type-check**

```bash
npm run type-check --workspace=packages/web -- --pretty false
```

Expected: PASS.

- [ ] **Step 3: Run lint**

```bash
npm run lint --workspace=packages/web
```

Expected: PASS.

- [ ] **Step 4: Run web tests**

```bash
npm test --workspace=packages/web -- --runInBand --silent
```

Expected: PASS.

- [ ] **Step 5: Run build**

```bash
npm run build --workspace=packages/web
```

Expected: PASS without "Skipping validation of types", without "Skipping linting", and without missing `SUPABASE_SERVICE_ROLE_KEY` errors when the environment is configured.

- [ ] **Step 6: Run audit**

```bash
npm audit --workspaces --audit-level=moderate
```

Expected: PASS, or documented non-runtime exceptions in `docs/maintenance/2026-04-30-branch-inventory.md`.

- [ ] **Step 7: Commit final verification notes**

Add a "Verification" section to `docs/maintenance/2026-04-30-branch-inventory.md`:

```markdown
## Verification

- `npm run type-check --workspace=packages/shared`: PASS
- `npm run type-check --workspace=packages/web -- --pretty false`: PASS
- `npm run lint --workspace=packages/web`: PASS
- `npm test --workspace=packages/web -- --runInBand --silent`: PASS
- `npm run build --workspace=packages/web`: PASS
- `npm audit --workspaces --audit-level=moderate`: PASS
```

Then commit:

```bash
git add docs/maintenance/2026-04-30-branch-inventory.md
git commit -m "docs: record stabilization verification"
```

### Task 7.2: Clean Local And Remote Branches After Verification

**Files:**
- Modify: `docs/maintenance/2026-04-30-branch-inventory.md`

- [ ] **Step 1: Delete local branches that are already merged**

```bash
for branch in feature/story-image-upload hotfix/active-transcript-highlight fix-deployment-clean; do
  if git show-ref --verify --quiet "refs/heads/$branch" && git merge-base --is-ancestor "$branch" origin/main; then
    git branch -d "$branch"
  else
    echo "KEEP $branch: not a merged local branch"
  fi
done
```

Expected: merged local branches are deleted; unmerged branches are listed with `KEEP`.

- [ ] **Step 2: List remote branches for deletion decision**

```bash
git branch -r --no-color | sed 's/^ *//'
```

Expected: output includes current remote feature/hotfix branches.

- [ ] **Step 3: Record final branch decision**

Append this section to `docs/maintenance/2026-04-30-branch-inventory.md` with actual branch names:

```markdown
## Final Branch Cleanup

- Deleted local branches:
  - `feature/story-image-upload` when `git merge-base --is-ancestor feature/story-image-upload origin/main` exits 0.
  - `hotfix/active-transcript-highlight` when `git merge-base --is-ancestor hotfix/active-transcript-highlight origin/main` exits 0.
  - `fix-deployment-clean` when `git merge-base --is-ancestor fix-deployment-clean origin/main` exits 0.
- Kept local branches:
  - `codex/preserve-main-ahead-2026-04-30` until docs commits are pushed or abandoned.
  - `codex/saga-stabilization-and-branch-cleanup` until the stabilization branch is merged.
  - Any feature/hotfix branch whose matching `git merge-base --is-ancestor BRANCH origin/main` check exits non-zero.
- Remote branches requiring owner confirmation before deletion:
  - `origin/feat-add-internationalization-support`
  - `origin/feature/story-image-upload`
  - `origin/hotfix/active-transcript-highlight`
```

- [ ] **Step 4: Delete remote branches only after owner confirmation**

Run only for branches explicitly approved for deletion:

```bash
git push origin --delete feat-add-internationalization-support
git push origin --delete feature/story-image-upload
git push origin --delete hotfix/active-transcript-highlight
```

Expected: approved remote branches are removed from `git branch -r` after `git fetch --prune origin`.

- [ ] **Step 5: Reset local `main` only after preserving the ahead commits and merging stabilization**

This step requires explicit human confirmation because it rewrites the local `main` pointer:

```bash
git switch main
git reset --hard origin/main
```

Expected: `git status -sb` shows `## main...origin/main` with no ahead/behind count. Recovery remains available through `codex/preserve-main-ahead-2026-04-30` and `/tmp/saga-main-ahead-2026-04-30.bundle`.

- [ ] **Step 6: Commit branch cleanup record**

```bash
git add docs/maintenance/2026-04-30-branch-inventory.md
git commit -m "docs: record final branch cleanup"
```

---

## Self-Review

### Spec Coverage

- Quality gate problem is covered by Phase 1 and final verification in Phase 7.
- AI route exposure is covered by Tasks 2.1 and 2.2.
- Admin service-role exposure is covered by Task 2.3.
- Client-controlled payment amount is covered by Task 2.4.
- API migration drift is covered by Task 3.1.
- Duplicate component and lint failure are covered by Tasks 3.2 and 3.3.
- Jest and test drift are covered by Phase 4.
- V1.8 audio-first recorder mismatch is covered by Task 5.1.
- Private media URL leakage is covered by Task 5.2.
- Dependency vulnerabilities are covered by Phase 6.
- Legacy backend and branch/worktree cleanup are covered by Phase 0 and Task 7.2.

### Placeholder Scan

- The plan contains no empty marker strings.
- The plan contains no unscoped deferred implementation work.
- Each code-changing task includes concrete file paths, code snippets, commands, and expected results.

### Type Consistency

- `requireAiRequest()` returns `guard.headers`, and AI routes use `jsonWithRateLimit()` with the same header type.
- `getPaymentPackage()` returns amount in Stripe cents, and `create-intent` passes `paymentPackage.amount` directly to Stripe.
- `ApiClient.get/post/put/delete` returns `ApiResponse<T>`, matching existing service usage of `response.data`.
- `SmartRecorder` completion payload includes `audioBlob`, `transcript`, and `duration`, matching the record page `handleRecordingComplete()` usage.
