# Task 1 implementation report

Status: implemented, self-reviewed, targeted validation passed. Independent specification/quality review and full verification are owned by the controller and are not claimed here.

Baseline: `f654e8631706c1c5b1d70742ed5088be1d10dce0`, branch `codex/october-upgrade-p0`, same checkout. No staging, commit, push, reset, migration or deployment. No remote services or real family data used.

## Root cause

- Registration and access checked authorization/deletion before waiting for Storage signatures, then released the resulting upload credentials or signed URL without rechecking current authority and asset identity.
- Completion checked deletion again after object metadata/stream verification but did not recheck project access or the full pinned identity before writing. Its previous CAS covered only id/state/version, and it published returned records without another authorization/deletion check.
- Ready/verifying no-Storage replays also relied on earlier permission checks rather than validating the record immediately before response publication.

## Owned changes

1. `packages/web/src/lib/server/media-asset-guard.ts`: new shared current-asset guard. Checks current project access, reloads `select('*')`, rejects malformed identity, compares id/project/story/bucket/object_key/kind/state/version, checks eligibility and optional asset tombstone, and queries authoritative asset/story deletion evidence as its last asynchronous operation. Failed/throwing/malformed queries deny with safe responses.
2. `packages/web/src/lib/server/__tests__/media-asset-guard.test.ts`: direct guard ordering, identity, malformed data, fail-closed and quarantine-response tests.
3. `packages/web/src/app/api/media/assets/route.ts`: checks after insert and before signing; checks pending replay before and after signing; checks non-signing replay before returning. Existing idempotency metadata checks, non-upsert uploads and retryable persisted registrations remain intact.
4. `packages/web/src/app/api/media/assets/__tests__/route.test.ts`: deferred-signing and no-Storage replay races, after-insert revocation, exact feature flag, retry preservation; existing success fixtures now model persisted inserted rows instead of fixed query-call counts.
5. `packages/web/src/app/api/media/assets/[assetId]/access/route.ts`: final guard after signing, before synchronous URL response.
6. `packages/web/src/app/api/media/assets/[assetId]/access/__tests__/route.test.ts`: deferred signing races for permission, deletion, every pinned identity field, query failures; TTL/exact locator and multiple refreshed-cookie coverage.
7. `packages/web/src/app/api/media/assets/[assetId]/complete/route.ts`: guards before both quarantine and successful CAS paths, plus final guards using the actual returned updated record; no-Storage replay guard. CAS retains state/version and additionally pins project/story/bucket/key/kind.
8. `packages/web/src/app/api/media/assets/[assetId]/complete/__tests__/route.test.ts`: deferred metadata/real-stream/CAS-return races, successful updated-version responses, identity CAS conflicts, no-Storage replays and failure semantics.

All three response helpers now reuse existing `withMediaHeaders`, retaining no-store and each refreshed Set-Cookie. No new external dependency or shared mutable authorization cache was introduced.

## TDD and validation evidence

Evidence directory: `docs/research/evidence/2026-10-30-media-revalidation/`.

Primary command for RED/GREEN:

```sh
npm test --workspace=packages/web -- --runInBand --testPathPatterns='(api/media/assets/|media-asset-guard|media-asset-verifier|project-hub-client)'
```

Executed with `set -o pipefail` and `2>&1 | tee <new evidence log>` to retain raw output and real command exit status.

| Step | Result | Log |
| --- | --- | --- |
| Initial route races, tests-only against baseline production code | Exit 1; 3 failed/2 passed suites; 49 failed/101 passed/150 total tests | `task1-red.txt` |
| Additional malformed-identity guard RED, before hardening guard shape checks | Exit 1; 1 failed/5 passed suites; 9 failed/165 passed/174 total tests | `task1-guard-red.txt` |
| Final targeted GREEN, including all routes, guard, real verifier and project hub client | Exit 0; 6 suites, 215 tests passed | `task1-green.txt` |
| `npm run type-check --workspace=packages/web` | Exit 0 | `task1-type-check.txt` |
| `npm run lint --workspace=packages/web` | Exit 0 | `task1-lint.txt` |
| `git diff --check` | Exit 0, no output | Command inspected locally |

The initial RED failures were security behavior failures, not syntax/fixture failures: old code returned 200/202 (or a quarantine record) after revocation/deletion/identity change, or still issued the CAS update after revoked access, missing/changed/tombstoned assets and asset-query failure. Existing deletion-before-CAS scenarios already passed and are retained. The later shape RED specifically returned `ok: true` for matching but invalid identities until validation was added.

After adding extra reloads, old static success fixtures were replaced with mutable persisted-row fixtures. This preserves the tested behavior while avoiding the incorrect assumption that the second asset query is always an update. Completion tests exercise the real `verifyMediaObjectStream`; the Storage/Auth/database boundaries are controlled test doubles, not live services.

## Specification self-review

- Permission is rechecked via the existing `requireProjectAccess`, not uploader identity.
- The final guard's deletion query is its last await; each successful publishing branch immediately constructs a synchronous response. No Storage, logging or other service await follows a successful final guard.
- No credential, upload token or asset record is returned on final guard failure. Permission denial and safe HTTP status handling retain refreshed cookies/no-store.
- Completion rechecks before both metadata-mismatch quarantine and stream-result CAS. It rechecks after CAS against the actual returned updated state/version, avoiding the false conflict of comparing a legitimate update against the original pending version.
- Audio remains `verifying` until the existing decoder confirmation; image behavior remains `ready`; verification failures remain `quarantined`, with existing 409/413 response logic untouched.
- CAS conflicts do not fabricate a successful record. If revocation/deletion is observed only after a CAS committed, the response is withheld but the implementation does not pretend to roll back that write.
- Existing rows are never deleted as compensation. Failed/unknown signing can be retried with the same idempotency key; upsert remains false.

## Schema correction acknowledged

The controller corrected the original task wording after checking `supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql`: the shipped `media_assets` table has **no `tombstone_at` column**. The implementation does not add an asset `.is('tombstone_at', null)` CAS predicate or a new schema migration. Optional tombstone evidence is read through `select('*')`; `deletion_requests` remains authoritative. CAS pins only shipped identity/state/version columns. The null-story predicate is `is('story_id', null)`, which is a shipped nullable column.

## Limitations and remaining independent work

- This is asynchronous-boundary revalidation, not atomic revocation. Permission, asset reload, deletion ledger and CAS are separate queries; permission may change after its last check, or deletion may commit between checks/CAS/publication. The final no-await return narrows application waiting but does not close those transaction windows.
- Previously issued signed URLs cannot be withdrawn here. Access signing still uses the existing 300-second TTL. Upload signing retains the existing Storage SDK lifetime/semantics; no new upload TTL guarantee is introduced.
- Direct Storage RLS, role-specific action authorization, production Auth/PostgREST behavior and cross-service transaction/locking design remain separate work. A local mocked-boundary test suite is not production authorization or immediate global revocation proof.
- No G0-G4 acceptance state, old experiment/evidence file, dependency, SQL migration or `packages/web/next-env.d.ts` was changed. No new milestone or push condition is asserted.
- Controller should perform independent specification and quality reviews plus full verification on this frozen diff. At report creation, implementation self-review has no known actionable defect; independent approval is pending.

Final staging state: owned tracked edits are unstaged; new guard/test/evidence files are untracked; index is unchanged. The controller's new plan/evidence directory are preserved. Source is frozen after the recorded 215-test GREEN, type-check and lint runs.
