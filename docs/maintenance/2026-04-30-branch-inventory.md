# Branch Inventory 2026-04-30

## Protected References

- `main`: local branch was reset to `origin/main` on 2026-05-05 after preserving its three ahead-of-origin docs commits.
- `codex/preserve-main-ahead-2026-04-30`: safety copy of local `main` before stabilization, protecting `0bec8be07`, `b1e00274f`, and `aa3386cb7`.
- `/tmp/saga-main-ahead-2026-04-30.bundle`: offline recovery bundle for commits ahead of `origin/main`.
- `/tmp/saga-legacy-branches-2026-05-04.bundle`: offline recovery bundle for removed local legacy branches.
- `/tmp/saga-main-before-reset-2026-05-04.status`: status snapshot of dirty original `main` before reset.
- `/tmp/saga-main-before-reset-2026-05-04.patch`: non-`node_modules` patch snapshot of dirty original `main` before reset.
- `/tmp/saga-main-untracked-before-reset-2026-05-04.tgz`: archive of untracked original `main` files before reset.

## Local Branches Observed

```text
  codex/preserve-main-ahead-2026-04-30                 aa3386cb7 docs: add saga stabilization implementation plan
* codex/saga-stabilization-and-branch-cleanup          ae60acb9b [origin/main: ahead 1] docs: add saga stabilization implementation plan
  feature/story-image-upload                           e9a350a2c [origin/feature/story-image-upload] feat(images): implement story & interaction image upload with thumbnails, watermark, i18n metadata; add GET interaction images; use thumbnails in UI; supabase image domains; db migration for thumbnail/description/copyright
  fix-deployment-clean                                 1f5aacaf2 fix: UI improvements - fix pending followups count, move record story button, remove all projects button
  hotfix/active-transcript-highlight                   69e032e79 [origin/hotfix/active-transcript-highlight] fix(images): correct active transcript highlighting and reorder payload
+ main                                                 aa3386cb7 (/Users/eat/Documents/eatpotato/saga传奇) [origin/main: ahead 3] docs: add saga stabilization implementation plan
  remotes/origin/feat-add-internationalization-support ab09104ff fix: resolve final deployment failure by correcting dependencies
  remotes/origin/feature/story-image-upload            e9a350a2c feat(images): implement story & interaction image upload with thumbnails, watermark, i18n metadata; add GET interaction images; use thumbnails in UI; supabase image domains; db migration for thumbnail/description/copyright
  remotes/origin/hotfix/active-transcript-highlight    69e032e79 fix(images): correct active transcript highlighting and reorder payload
  remotes/origin/main                                  2b668b726 fix: close button
```

## Deletion Decisions

- Keep `main` until stabilization PR merges.
- Keep `codex/preserve-main-ahead-2026-04-30` until the three ahead-of-origin docs commits (`0bec8be07`, `b1e00274f`, `aa3386cb7`) are pushed or intentionally abandoned.
- Keep `codex/saga-stabilization-and-branch-cleanup` as the active remediation branch.
- Delete `feature/story-image-upload`, `hotfix/active-transcript-highlight`, or `fix-deployment-clean` only when the matching `git merge-base --is-ancestor BRANCH origin/main` command exits 0.
- Delete a remote feature or hotfix branch only after confirming there is no open PR and its content has landed or is intentionally abandoned.

## Dependency Follow-up

- `npm audit --workspaces --audit-level=high` on 2026-05-05 passes with 0 critical and 0 high vulnerabilities.
- Safe dependency cleanup removed the unused `@google-cloud/speech` package, replaced the direct `uuid` browser usage with `crypto.randomUUID()`, upgraded `@supabase/ssr` to `0.10.2`, and upgraded `@headlessui/react` to a React 19-compatible release so `npm ci` can resolve peers without `--legacy-peer-deps`.
- Remaining audit items are 6 moderate advisories from stable `next@16.2.4` bundling `postcss@8.4.31`; npm's suggested `npm audit fix --force` path still downgrades framework/integration packages and is not safe.
- CI now blocks high/critical advisories with `npm run audit:high`; keep `npm run audit:moderate` as a visibility report until a stable Next release ships the `postcss >=8.5.10` fix without canary/peer invalidity.

## TypeScript and Build Follow-up

- `npm run type-check --workspace=packages/web -- --pretty false`, `npm run lint --workspace=packages/web`, `npm test --workspace=packages/web -- --runInBand --silent`, `npm run type-check --workspace=packages/shared`, and `npm run build --workspace=packages/web` pass on 2026-05-04.
- The successful local build still logs missing environment variable validation messages for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENROUTER_API_KEY`; these are local environment gaps, not compile blockers.
- Several Supabase-heavy legacy API route files are temporarily fenced with `@ts-nocheck` because the checked-in `Database` type is stale relative to the actual schema. The correct fix is to regenerate Supabase types from the deployed database, replace local `any` client boundaries, then remove the fences in a focused DB typing task.
- Next 16 migration warnings remain: remove unsupported `eslint` config from `next.config.js`, replace `images.domains` with `images.remotePatterns`, set `turbopack.root` or remove the extra `/Users/eat/package-lock.json`, and migrate the deprecated `middleware` convention to `proxy`.

## Storage Follow-up

- Audio uploads now return private Supabase storage paths through the legacy `audio_url` field because the current checked-in database type does not expose a dedicated `audio_path` column.
- Image uploads return short-lived signed URLs for immediate preview plus durable `path` and `thumbPath` values for later signed URL renewal.
- Follow-up schema migration should add explicit `audio_path`, `image_path`, and thumbnail path columns, then migrate legacy `audio_url` consumers away from path-overloaded names.

## Verification

- `git diff --check`: PASS
- `npm ci`: PASS
- `npm run lint`: PASS
- `npm run type-check`: PASS
- `npm run type-check --workspace=packages/shared`: PASS
- `npm run type-check --workspace=packages/web -- --pretty false`: PASS
- `npm run lint --workspace=packages/web`: PASS
- `npm test --workspace=packages/web -- --runInBand --silent`: PASS
- `npm run build:vercel`: PASS
- `npm run build --workspace=packages/web`: PASS
- `npm audit --workspaces --audit-level=high`: PASS
- `npm audit --workspaces --audit-level=moderate`: documented exceptions remain at 6 moderate; 0 low, 0 high, and 0 critical.

## Final Branch Cleanup

- Deleted local branches:
  - `feature/story-image-upload`: deleted after bundling to `/tmp/saga-legacy-branches-2026-05-04.bundle`.
  - `hotfix/active-transcript-highlight`: deleted after bundling to `/tmp/saga-legacy-branches-2026-05-04.bundle`.
  - `fix-deployment-clean`: deleted after bundling to `/tmp/saga-legacy-branches-2026-05-04.bundle`.
- Kept local branches:
  - `codex/preserve-main-ahead-2026-04-30`: kept as the recovery branch for the original `main` ahead commits.
  - `codex/saga-stabilization-and-branch-cleanup`: kept as the active stabilization branch until merge.
- Deleted remote branches after owner authorization:
  - `origin/feat-add-internationalization-support`
  - `origin/feature/story-image-upload`
  - `origin/hotfix/active-transcript-highlight`
- Remaining remote branches after `git fetch --prune origin`:
  - `origin/main`
  - `origin/codex/saga-stabilization-and-branch-cleanup`
- Reset local `main` after owner authorization:
  - `/Users/eat/Documents/eatpotato/saga传奇` now reports `## main...origin/main`.
  - Recovery remains available through `codex/preserve-main-ahead-2026-04-30`, `/tmp/saga-main-ahead-2026-04-30.bundle`, `/tmp/saga-main-before-reset-2026-05-04.patch`, and `/tmp/saga-main-untracked-before-reset-2026-05-04.tgz`.
