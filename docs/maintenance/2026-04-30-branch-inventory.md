# Branch Inventory 2026-04-30

## Protected References

- `main`: local branch was ahead of `origin/main` by docs commits on 2026-04-30.
- `codex/preserve-main-ahead-2026-04-30`: safety copy of local `main` before stabilization.
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
- Keep `codex/preserve-main-ahead-2026-04-30` until the two docs commits are pushed or intentionally abandoned.
- Keep `codex/saga-stabilization-and-branch-cleanup` as the active remediation branch.
- Delete `feature/story-image-upload`, `hotfix/active-transcript-highlight`, or `fix-deployment-clean` only when the matching `git merge-base --is-ancestor BRANCH origin/main` command exits 0.
- Delete a remote feature or hotfix branch only after confirming there is no open PR and its content has landed or is intentionally abandoned.
