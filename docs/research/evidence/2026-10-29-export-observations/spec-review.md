# Specification review

- Reviewer: `/root/export_spec_review`
- Verdict: PASS; no actionable specification omission, implementation error or scope expansion.
- Scope: current uncommitted export-observation slice relative to `a605fbf1e`; not original G0-G4 qualification.

The reviewer inspected actual SQL, route, adapters and tests. Persistent start precedes Storage; finish precedes final member/tombstone checks; unavailable writes block the archive. Cancellation, deletion and revocation during reader/finish waits retain blocking paths. Typed SHA/size mismatch is distinct from other outcomes.

The minimum ledger, real-role ACLs, immutable terminal state, replay/conflict locks, fixed epoch, no-argument STABLE/invoker v2 and unchanged v1 satisfy the plan. Completion-time aggregation includes the exact window boundary; pending and invalid attempts are global. The loader preserves microseconds, incomplete states remain explicit and invalid data is not zeroed. Upload, provider and delivery availability are not fabricated.

Independently reran targeted Jest: 7 suites / 159 tests passed. Staged and unstaged diff checks passed. Verified 24 PG-index source/artifact hashes, gzip/raw equality, frozen source Git bytes and all 1398 protected inputs. Inspected normal/polluted reports (12 scenarios / 464 assertions each) and cleanup evidence; did not independently rerun PG.

Required final-report clarification: `windowComplete` is ledger epoch age only, not proof that every old/new instance during rolling deployment records all requests. Production/PostgREST, full migration-chain, client delivery and original G0-G4 acceptance remain outside this review.

The reviewer changed no files. Task 4 final evidence/document closeout is tracked separately.
