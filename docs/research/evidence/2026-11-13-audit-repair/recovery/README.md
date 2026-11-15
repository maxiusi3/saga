# Q1/Q2 recovery repair evidence

The production source files used by this scope are listed and SHA-256 pinned in `source-sha256.json`. No historical migration was edited. No commit, push, remote migration, deployment, paid provider request or real-user notification was performed.

| Verification | Result | Evidence |
| --- | --- | --- |
| Original regression tests before implementation | 4 expected failures: ZIP committed acknowledgement loss, cleanup fault, reconciliation unknown, Storage503 permanent pending | `jest-red.log` |
| Native SQL before migration | Expected failure: reservation lacks durable lease token | `native-red.log`, `native-1794559803473-5a70e48e-b207-4e3b-a7ee-dc0e25985c71/report.json` |
| UI regression before recovery control | Expected failure: retry button absent | `ui-red.log` |
| Commit audio-pointer regression | Expected failure: changed pointer still committed | `commit-audio-red.log` |
| Cleanup queue regression | Expected failure: stale queue row left indefinitely | `cleanup-queue-red.log` |
| Focused Jest | 6 suites, 91 tests passed | `jest-green.log` |
| Targeted ESLint | Passed, zero output | `lint.log` |
| Native SQL + real SDK / loopback provider + real ZIP worker | Passed, 445 assertions | `native-green.log`, `native-1794564096348-dbec7155-e328-4ae6-a1c0-de250c5b5100/report.json` |
| Same native run plus installed Chrome / production handlers and controls | Passed, 681 assertions | `native-chrome.log`, `native-1794564594061-06543662-89b8-4aa9-98bd-87d4dcac133a/report.json` |
| Independent-review regression | Six stale-snapshot cleanup cases failed before correction; changed audio-pointer readiness failed natively | `review-race-red.log`, `review-pointer-red.log` |
| Review fix focused Jest | 6 suites, 97 tests passed | `review-jest-green.log` |
| Review fix native + Chrome | Passed, 730 assertions; includes actual concurrent production worker completing ZIP while cleanup has an older DB response | `review-native-chrome.log`, `native-1794567914438-c615bd09-4207-475e-86d8-d70b69392350/report.json` |
| Reviewer original race repro | `referencedZipExists: true` | `reviewer-race-green.log` |
| Review fix type-check / ESLint | Passed, zero output | `review-typecheck.log`, `review-lint.log` |
| Scoped diff whitespace check | Passed | root reports final repository state |

## Reproduction

```sh
node experiments/pg17-processing-recovery/verify.mjs --chrome
npm test --workspace=packages/web -- --runInBand --watchman=false src/components/stories/__tests__/story-transcription-control.test.tsx src/lib/server/__tests__/publication-delivery-worker.test.ts src/lib/server/__tests__/story-transcription-io.test.ts src/lib/server/__tests__/story-transcription.test.ts src/lib/server/__tests__/story-review-service.test.ts 'src/app/api/stories/\[storyId\]/transcribe/__tests__/route.test.ts'
```

The standalone native runner includes the complete bootstrap/migration chain through `20261113000001_processing_recovery.sql`; repair migrations `00002` onward are intentionally delegated to the parent full-chain run. It uses the existing native PostgreSQL17.4 runtime at `/tmp/saga-g1-runtime/install/bin`. Temporary clusters use a private Unix socket, no database TCP listener, and are shut down/removed in `finally`. HTTP services bind only loopback and admit synthetic credentials.

`report.json` records migration/source digests, actual roles, assertions, cleanup, provider call counts and boundary declarations. `transcription-chrome-report.json` records actual route responses, controlled multipart sends, privacy/CAS rejection, unknown-pending reload and safe Storage503 retry. The screenshots `chrome-transcription-retry-before.png` and `chrome-transcription-retry-after.png` were opened for visual inspection: consent is unchecked and retry disabled before explicit confirmation; afterward actual timed source excerpts and audio controls are visible.

Earlier native run directories are preserved as failed/red or intermediate evidence, not presented as final results. An intermediate whole-web `typecheck.log` captures dependency-migration errors outside the recovery scope (waitlist/pilot-ledger Zod changes); the parent owns the final type-check and full `verify` gate. Recovery's modified graph had no TypeScript diagnostics in that run.

The tests do not qualify real ElevenLabs accuracy/account policy, hosted Supabase behavior or deployment readiness. Legacy/outbound unknown attempts and exhausted preparation budgets deliberately remain pending. No provider outcome is guessed, and no force-resend capability was introduced.

## Independent review fixes

The P1 cleanup race was reproduced against real filesystem state in six new Jest cases: stale queued/running/failed/missing job reads in the ordinary sweep, and stale failed/missing reads in the durable cleanup queue. The fix captures attempt names before the fresh database read, then only cleans those captured attempts. A missing job no longer permits recursively removing a root that can acquire a new lease directory; only atomic empty-directory removal is attempted. The authoritative claim protocol uses newly generated tokens, so a later claimant creates a new, uncaptured directory. The native verification also interleaves an actual queued SQL response with another full production worker completing and committing a ZIP, then checks the surviving ZIP digest and CRC.

The P2 retry-readiness bug was reproduced natively after reserve/release followed by clearing the story audio URL. The state function now checks the reserved asset's canonical audio pointer before returning `retryableRequestId`. Both explicit-request status and readiness GET are checked for null and replaced pointers. The request remains pending; the response does not advertise a retry that the outbound fence will reject.

Only the worker, forward recovery migration, focused recovery tests and evidence/docs changed during these review fixes. The historical migrations remain untouched; files remain uncommitted. The final whole-web tsc run after the parent dependency updates passed (the earlier typecheck log remains retained as intermediate evidence).
