# Branch Inventory 2026-04-30

## Protected References

- `main`: local branch was ahead of `origin/main` by three docs commits on 2026-04-30.
- `codex/preserve-main-ahead-2026-04-30`: safety copy of local `main` before stabilization, protecting `0bec8be07`, `b1e00274f`, and `aa3386cb7`.
- `/tmp/saga-main-ahead-2026-04-30.bundle`: offline recovery bundle for commits ahead of `origin/main`.

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

- `npm audit --workspaces --audit-level=moderate` on 2026-05-04 reports 0 critical and 0 high vulnerabilities after upgrading direct dependencies and applying safe audit fixes.
- Remaining audit items are 2 low and 9 moderate advisories: `@google-cloud/speech` via `uuid`, `@sentry/nextjs` / `@vercel/analytics` / `@vercel/speed-insights` / `next-intl` via `next` and `postcss`, `@supabase/ssr` via `cookie`, and `brace-expansion`.
- Do not run `npm audit fix --force` blindly: npm currently suggests breaking or incorrect remediation paths, including downgrading `next` to `9.3.3`, downgrading `next-intl` to `0.0.1`, downgrading `@google-cloud/speech` to `4.4.0`, and major-upgrading `@supabase/ssr` to `0.10.2`.
- Safe follow-up is to upgrade the affected direct packages deliberately in separate compatibility tasks, with focused smoke tests for Supabase auth/session behavior, Sentry/Next instrumentation, analytics loading, speech transcription, and UUID call sites.
