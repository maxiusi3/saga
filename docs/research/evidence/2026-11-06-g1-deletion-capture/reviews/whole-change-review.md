# G1 deletion capture — whole-change Spec and Quality review

Reviewed 2026-11-06 against `docs/superpowers/specs/2026-11-06-g1-deletion-capture-design.md`, its implementation plan and `CLAUDE.md`.

**Spec: Changes requested. Quality: Changes requested.**

**Findings: 0 Critical, 1 Important, 0 Minor.** There is one unique integration defect, I1 below, affecting both axes. Candidate-aware backup compatibility is approved within its stated manifest/restore-set boundary. The previous scoped reviews remain valid for their scopes; their earlier I1/I2 are not reopened. This whole-change verdict is not approval to merge, push, migrate or deploy.

## Important I1 — an in-flight seal can commit sources after the immutable capture

**Changed integration point:** `supabase/migrations/20261106000002_media_deletion_capture.sql:55–63` and `:114–118`. **Unchanged dependency exposing it:** `supabase/migrations/20261102000001_recording_seal_manifest.sql:111–145` and `:179–190`.

The new capture's `SHARE ROW EXCLUSIVE` source locks block an INSERT but permit the preceding `SELECT ... FOR UPDATE` table `ROW SHARE` lock. The existing seal routine checks deletion at line 137 without first taking the publication/confirmation deletion-table fence, then reads/inserts its session and chunks. A seal which passed that check can therefore wait behind capture, resume after the tombstone commits, and successfully register source coordinates absent from `deletion_targets`. Subject replay correctly preserves the original snapshot, so it cannot repair this omission.

This violates the design's source-population requirement (“so inserts/rebinding/publication cannot escape the captured snapshot”) at an actual existing application dependency. It does not require a future noncooperating writer, Storage GC, a simulated replacement routine, or a changed production trigger. The application's later deletion recheck can prevent subsequent asset/job registration, but cannot roll back the already committed seal transaction or add these chunks to the immutable deletion target population.

### Native reproduction and raw evidence

I reproduced this with actual, unmodified migrations and actual `service_role` connections using the existing isolated PostgreSQL 17.4 harness. The parent explicitly authorized this focused probe and its preserved evidence after the concrete integration doubt was identified. No production source, old migration, routine body or trigger was edited. A separate transaction takes a temporary `EXCLUSIVE` lock on `recording_sessions` solely to schedule real waiters.

1. Reserve a real story through `recording_story_save`; prepare a valid actual application manifest. No session/chunk is yet registered. A synthetic Storage object at the future chunk address already exists.
2. Start actual `seal_recording_manifest`. Its `ROW SHARE` wait on `recording_sessions` proves it passed the earlier tombstone query and reached `SELECT ... FOR UPDATE`.
3. Start capture. It gets the deletion fence and waits behind the scheduling transaction for `SHARE ROW EXCLUSIVE` on `recording_sessions`.
4. Release the scheduling transaction. PostgreSQL grants these two compatible source locks; seal's subsequent `ROW EXCLUSIVE` INSERT lock now waits on capture. Capture sees no session/chunk, returns one story target and commits.
5. Seal resumes and **also returns success**, committing one session and one actual chunk. A fresh same-subject capture returns the same original one-target receipt; the full database state does not change on replay.

Authoritative evidence directory: `docs/research/evidence/2026-11-06-g1-deletion-capture/review-seal-overlap-03/`.

- `results.json:36`: all three actual waits, blocker PIDs and granted/ungranted lock rows.
- `results.json:485`: successful capture of request `30a5de2b-38ed-4596-a60c-72f6c4a137bb`, subject `c2cdf332-6267-4e39-998b-b32f5a20485a`, `targetCount:1`.
- `results.json:498`: transaction-local requests/targets and empty session/chunk populations before capture commit.
- `results.json:534` and `:564`: successful seal receipt and complete committed after-state.
- `results.json:732` and `:910`: unchanged replay receipt and the missed coordinate `audio-recordings:11111111-1111-4111-8111-111111111111/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sessions/2964a26c-6f19-4a63-a745-2f4186b0944a/0`.
- The run records 38 assertions, zero current-source hash mismatches, stopped cluster, removed scratch directory, zero remaining clients and no cleanup errors. The existing synthetic Storage metadata is unchanged. This is a source-registration race, not evidence that any physical object was deleted.

SHA256 of `reproduce.mjs`: `2ce4946a01f4b86d9dc92fa9af88f1c7e67682fdc4630985876e7e9d1f1ca5b4`.
SHA256 of `results.json`: `490194201b0fa31fbe91bf1048a83572244a8d649cd1c41123fafaf8b24a4962`.

Exact successful command was `node docs/research/evidence/2026-11-06-g1-deletion-capture/review-seal-overlap-03/reproduce.mjs` from the repository root. To reproduce again, copy the runner into a **new** uniquely named evidence directory before invoking it; it writes `results.json` beside itself and the frozen result must not be overwritten. Attempts `review-seal-overlap-01` and `-02` are preserved as diagnostic failures: 01 had an encoded-file-URL output-path error; 02 then recorded a missing synthetic bucket FK setup failure, before any race waits. Neither is positive evidence. 03 adds the necessary synthetic bucket and uses `fileURLToPath`; production inputs are identical.

### Minimum fix and scoped acceptance

Use an additive new migration to replace the seal routine; retain the historical migration bytes. Make seal participate in the deletion-table `SHARE` fence **before its advisory lock, authority/source locks or database source reads**, with bounded waiting. Keep the fence until the enclosing transaction ends. Preserve its existing input, identity, privilege and replay checks.

The fence also needs correct snapshot semantics: reject non-`READ COMMITTED` execution before mutation and retain `VOLATILE` fresh-query behavior. Merely adding a lock does not refresh a `REPEATABLE READ`/`SERIALIZABLE` snapshot that was established before waiting; the old seal has no isolation guard. This is part of I1's fix, not a second independent finding. PostgreSQL's documented explicit-lock/snapshot rule is consistent with the existing finalizer and capture isolation checks: <https://www.postgresql.org/docs/current/applevel-consistency.html>.

Add native tests against the actually migrated routine for both orders: seal first must either finish before capture (and its exact committed chunk set is captured), or one operation must safely fail; capture first must make the waiting seal reject without new session/chunk rows. Retain a deterministic queued-lock regression for the reproduced check-then-insert gap. Also prove a pre-established non-RC snapshot is rejected with full rows unchanged. Verify service-only EXECUTE and existing legitimate sealed-but-unregistered capture behavior remain intact. Re-freeze affected sources, run the necessary gate, then perform a scoped I1 re-review; a second broad review is not requested by this finding.

## Spec assessment of the remaining change

The production capture is a single service-only, fixed-search-path, UTC, `VOLATILE` routine requiring `READ COMMITTED`, with a three-second lock timeout. Deletion requests serialize before authority and source discovery. Current project ownership/active facilitator checks happen after waits; malformed, cross-project, blocked and ambiguous identities fail closed. Candidate/session/job cross-bindings and unsafe or externally aliased coordinates reject before writing.

Source discovery and target construction cover selected actual assets, story metadata, bound persisted chunks and reserved/prepared candidate addresses. Published candidate aliases are deduplicated by bucket/key. Asset-only capture leaves sibling assets alone. The previous sealed-before-registration fix captures actual chunks without inventing missing asset/job rows. Scoped postwrite tuple checks plus rediscovered graph membership protect required writes against suppression, rebinding, phantom insertion and later trigger tampering. Unfinished jobs receive only `cancel_requested_at`; terminal jobs, attempts and candidate evidence remain intact.

Replay checks the supplied ID collision before subject lookup, requires the same actor/project/type/subject, refuses incomplete legacy captures, checks durable target count and full-tuple SHA256, and returns the immutable receipt without additional mutation. Candidate paths remain in the private targets table; the member-readable request carries only count and digest. No broad client write/EXECUTE grant or Storage removal was introduced.

The route retains authentication/project-access checks, explicit exclusive subject selection, UUID validation, 202 `deletionRequest`, auth headers and no-store. The adapter pins a copied input, validates the complete closed receipt, bounds timeout/cancellation independently of SDK cooperation, disables SDK retries, and translates errors to generic categories. Subject replay may return the original request ID even if a caller generated a new ID after losing a response, which is intentional. I inspected the installed PostgREST implementation of `.abortSignal(...)` and `.retry(false)` as well as the actual service client; these methods exist and are used in the supported order. No application multi-write fallback remains.

The backup production diff only adds `recording-candidates` to the existing type and TS/CJS allowlists. Its tests preserve size, hash, path, duplicate-key and unknown-bucket checks. Actual CLI file mode and a runner fed from real native capture coordinates agree. The added migration-inventory line checks the declared file ordering and does not assert full migration execution. No backup ledger or physical restore was fabricated.

## Quality and independently checked evidence

I reviewed the whole 27-file source manifest and exact takeover-byte diff, relevant existing foundational DDL, actual seal/registration and story-confirmation call sites, finalization/lease/candidate integration, authorization helpers, both backup implementations, new tests/runners, progress docs and the two scoped review reports. Scope was not limited to task patches. Apart from I1, no actionable Critical/Important/Minor defect or documented-standard breach was found. The conservative table-lock architecture and remaining scan/throughput cost are explicitly accepted for this local slice; the narrowed JSON scopes avoid unrelated story-body serialization without weakening the verified required-row checks.

Independently verified:

- All **27** `whole-change-hashes.json` entries match current bytes. Rebuilding the unified diff from the saved `before/` contents exactly reproduces `whole-change.patch`. Patch SHA256: `f22f71aa563c4f68f7246b4e8fe6b1c0b1889ab7754b582b4a83e739caeabc53`; manifest SHA256: `09f72c0e1c97b03a2d91499196b699dd07ca7976e1016c058eb461815addceef`.
- All **4,680** prior evidence files still match baseline hashes. Of **1,344** takeover inputs, only the eleven declared owned existing files differ; all stored baseline copies match. HEAD remains `c0669e8058343f91deba8e468b03e4bf817b1ca5`, staged diff/index comparison remains empty, and `git diff --check` exits 0.
- The full gate and both parent native-command archives match their compressed and decompressed hashes. Their **903** source-before/source-after maps are equal and all current files still match. Raw full-gate output confirms **Web 160/3259, shared 4/16, infra 23/23, production build 184 pages**, exit 0. The exact next-env baseline/restored hash is `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`.
- Parent frozen capture `native-1793935758219-bdb59613-e1ca-4ed6-93f3-48aca8683817/results.json` has SHA256 `ff144c99f33f13f28dbcb8512855bb9bef5bfa425121f6d5ed8040da9b96f70c`; all **30** recorded source hashes match. Its **16 groups/699 assertions**, **8 actual waits** and **12 failure injections** are present. I independently compared every injected full before/after row set and synthetic bytes (all identical on rejection), inspected wait blockers/ungranted locks, and reconstructed the seven main successful direct-receipt target sets from recorded sources (counts 4, 10, 5, 6, 3, 1, 4). The previously completed sealed-only fix remains present. These passing scenarios did not cover the new overlapping seal gap.
- Parent backup `native-backup-1793935759391-b9e5a10b-441b-4d24-b6bc-16c9624b13f5/results.json` has SHA256 `bf171e8b197e2dbefb047cdc33feaf39eada38f9e595b3a82b9b777da5502ad2`; all **28** sources and **7** artifacts match hashes/byte sizes. Its actual capture storage rows exactly supply tombstone bucket/key. Freeze `2026-11-06T03:29:24.027Z` precedes capture `2026-11-06T03:29:24.039217+00:00`; normalization to milliseconds preserves this order. I independently filtered the manifest using those actual coordinates: exactly the published candidate is excluded, complete entries 0/2/3 survive, totaling **90 bytes**. TS, CJS and parsed actual CLI output match this complete set. All four synthetic object byte/hash fields, fourteen negative parity results and unchanged full after-replay database/file snapshots agree.

No broad suites were rerun during review. The only runtime test newly run was the specific uncovered seal race. New review outputs consist of this report and the parent-authorized additive reproduction directories; all 27 frozen production/test/document inputs remain unchanged.

## Remaining qualification and disposition

After I1 is fixed, physical deletion/executor behavior, reference-safe GC and inflight Storage-write reconciliation still require separate engineering. The 55-byte synthetic PGDMP fixture is not restorable; candidate acceptance and computed survivor sets do not prove downloads, actual object bytes, `pg_dump`/`pg_restore`, or a qualified backup ledger. Selected migrations atop synthetic prerequisites do not qualify the full migration chain. Global contention/scale, hosted PostgREST/cloud policy, devices and long recordings remain open. G1 and push qualification remain false.

The current docs accurately leave final review/archive pending; update their completion status only after I1 and its scoped acceptance. One consolidated I1 fix wave is required before this batch can be called locally complete.
