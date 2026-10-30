# Task 1 Independent Review

## Specification Verdict: PASS

No actionable specification defect found in the frozen eight-file snapshot against `task-1-brief.md`. This verdict covers the requested asynchronous-boundary revalidation, not atomic revocation or release-gate completion.

| Requirement | Review evidence |
| --- | --- |
| Actual current project authority, not uploader ownership | `packages/web/src/lib/server/media-asset-guard.ts:21` calls the existing `requireProjectAccess`. The named cross-module check confirms that helper reads the project and active project role (`packages/web/src/lib/server/project-access.ts:25`, `packages/web/src/lib/server/project-access.ts:49`). |
| Reload and pin asset identity, state and version; fail closed | `packages/web/src/lib/server/media-asset-guard.ts:24` reloads the row; `:28` validates its shape; `:33` compares id/project/story/bucket/key/kind/state/version and rejects optional tombstone evidence or an ineligible state. Missing rows, query errors and thrown errors deny. |
| Authoritative asset/story deletion checks last | `packages/web/src/lib/server/media-asset-guard.ts:43` performs the final awaited query, scopes it to the project and both subject IDs, and rejects malformed/error/nonempty deletion results. |
| Access credentials checked after Storage | `packages/web/src/app/api/media/assets/[assetId]/access/route.ts:55` guards after signing and directly returns the response without further service work. The exact stored locator and existing 300-second TTL remain unchanged. |
| Registration and replay boundaries | `packages/web/src/app/api/media/assets/route.ts:129` guards pending and no-Storage replays; `:135` guards after replay signing; `:174` guards after insert and before signing; `:179` guards after new signing. Existing metadata conflict checks, unique-key winner replay, `upsert: false`, and persisted-row retry behavior remain intact. |
| Completion checks before every CAS | `packages/web/src/app/api/media/assets/[assetId]/complete/route.ts:81` guards the metadata-mismatch quarantine path; `:104` guards both real-stream outcomes. The shared update builder at `:65` pins id/project/story/bucket/key/kind/state/version. |
| Correct post-CAS expectation and result withholding | `packages/web/src/app/api/media/assets/[assetId]/complete/route.ts:90`, `:115`, and `:131` guard against the actual returned quarantine/verification row, rather than its original state/version. Guard failures do not return an asset or pretend the committed write was rolled back. |
| State and HTTP contracts | `packages/web/src/app/api/media/assets/[assetId]/complete/route.ts:60` retains ready/verifying no-Storage replay. `:117` retains verification failure status selection; `:120` retains image-ready/audio-verifying behavior. All final successful guards lead directly to synchronous response construction. |
| Privacy, no-store, refreshed cookies | New failures use static safe messages. All three routes use the existing synchronous `withMediaHeaders`; its implementation at `packages/web/src/lib/server/media-access.ts:11` preserves individual Set-Cookie values and forces no-store. Authentication-first and exact `MEDIA_ASSETS_ENABLED === 'true'` handling remain. |
| Shipped schema compatibility | `supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql:137` defines a nullable `story_id` and integer `version`, but no asset `tombstone_at`. The new CAS uses only shipped columns, with `is('story_id', null)` for the null case. Optional asset tombstone checks use `select('*')`; authoritative deletion evidence remains in `deletion_requests`. No migration was changed. |

## Quality Verdict: Approved

No actionable correctness, maintainability or regression finding found within the review scope. No code changes requested.

- The shared guard is small, stateless and explicitly documents its transaction limitation. It centralizes the newly added security checks without introducing authorization caches, new roles or a storage abstraction.
- The route tests use deferred Storage/stream/CAS-return boundaries and mutable row fixtures. They check credential/result withholding, zero writes after failed pre-CAS checks, pinned-identity CAS conflicts, and legitimate post-update responses.
- The success fixtures now represent persisted inserts and committed updates rather than assuming a fixed query-call count. Existing upload idempotency, unknown-signing-failure retry, non-upsert behavior and audio/image/quarantine contracts remain covered.
- New direct guard tests cover ordering, every pinned identity field, matching-but-malformed identities, denied access, malformed ledger data and safe exception handling. The routes and helper conform to the relevant server-I/O and adjacent-test conventions in `CLAUDE.md`.

## Evidence Reviewed

- Review base: `f654e8631706c1c5b1d70742ed5088be1d10dce0`; review input: `.superpowers/sdd/2026-10-30-upgrade-media-revalidation/task-1-review.diff` and its brief/report.
- All eight current source/test blob hashes match the new-side blob hashes in the frozen diff. Its introductory stat lists six tracked changes; the two added guard files are also present in the diff and were reviewed.
- `task1-red.txt`: 49 failed, 101 passed, 150 total. Inspected failures show old credential/success publication or writes after invalidation, rather than fixture syntax failures.
- `task1-guard-red.txt`: 9 failed, 165 passed, 174 total. Inspected failures show matching malformed identities incorrectly accepted before the shape checks.
- `task1-green.txt`: 6 suites and 215 tests passed. `task1-type-check.txt` and `task1-lint.txt` contain the recorded clean runs; the implementation report records exit 0 for both.
- No already-evidenced suite was rerun during this independent review. No new runtime command was necessary to resolve a concrete remaining code doubt. Full verification belongs to the controller.
- Review was read-only except for this report. No source, index, branch, frozen evidence, migration or remote resource was changed. No subagent was spawned. The reviewer used the inherited runtime; the controller reported that the explicitly selected model endpoints were unavailable.

## Not Verified / Residual Limits

- Auth/PostgREST/Storage are mocked test boundaries. The evidence does not establish production integration behavior, direct Storage RLS, role-specific action authorization or live multi-connection transaction behavior.
- Project access, asset reload, deletion ledger and CAS remain separate queries. Changes after a component check, between checks/CAS, or after the final check are not made globally atomic by this patch. The synchronous publication rule removes additional application service waits; it does not remove those database/concurrency windows.
- Previously released signed URLs are not revoked by these guards. The existing access TTL and Storage upload-token lifetime remain separate concerns, not newly proven revocation guarantees.
- This approval does not certify the controller's pending full verification, G0-G4 acceptance, deployment readiness or a milestone that authorizes pushing.
