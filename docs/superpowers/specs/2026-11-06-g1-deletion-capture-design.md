# G1 atomic deletion capture and recording-candidate backup coverage

## Intent and current defect

The user accepted the previous delivery and requested the next G1 step. The authorized direction is candidate deletion/backup coverage, reference-safe GC and migration-chain qualification. This batch establishes durable deletion capture and candidate-aware backup validation; physical removal/GC and full migration-chain rehearsal remain separate deliverables.

The current `/api/media/delete-request` reads assets before inserting the tombstone, does not persist its generated targets, and ignores later asset/job update failures. Concurrent recording publication can change the asset's Storage key between observation and tombstone insertion. The existing backup validators reject the `recording-candidates` bucket, although published original audio now lives there.

## Chosen boundary

Replace application-side multi-write capture with one service-only, VOLATILE PostgreSQL RPC under READ COMMITTED. Acquire a deletion-table lock conflicting with the existing publication/confirmation SHARE fence before reading target addresses; use a bounded lock timeout and lock the relevant authority and source population so inserts/rebinding/publication cannot escape the captured snapshot. A wait must be followed by a fresh read. Native races must establish the exact order and absence of missed targets. Conservative table locks are acceptable for this local correctness slice; throughput/cloud qualification is not claimed.

The RPC accepts trusted actor identity, project, exactly one explicit subject kind (`media_asset` or `story`) and UUID. The server supplies a request UUID. It independently checks the current project owner or active facilitator, subject ownership and blockers while locks are held. Cross-family identities, inactive/non-manager actors, missing subjects, malformed arguments and ambiguous/legacy requests fail closed. Route authentication and project-access checks remain but do not substitute for SQL authorization.

The transaction writes one tombstone plus deduplicated durable `deletion_targets`, transitions applicable assets to `deleting`, and requests cancellation of unfinished jobs without fabricating a completed attempt or successful physical deletion. Terminal job and candidate evidence stays intact. Errors, suppressed writes or altered required tuples must abort the transaction before a receipt is issued.

Targets cover the subject's actual current assets, bound recording sessions and their persisted chunk addresses, and all reserved/prepared candidate addresses associated with those assets/sessions/jobs. Published candidate aliases must appear only once as a physical bucket/key. Include a story metadata target for a story request and media-asset targets for each selected asset. Only actual metadata addresses are recorded; no guessed old path. Reject inconsistent cross-project relationships and unsafe object addresses rather than registering them for later removal. An asset-only request must not expand to another story's unrelated assets. Candidate metadata is retained as evidence, not deleted here.

Mark new captures with an explicit schema/capture version and subject kind on the durable request. Replaying the same subject or request ID must recover its immutable capture without a second request, target duplication, timestamp rewrite, or further asset/job mutation. Verify the durable target population before returning replay. An existing legacy request without a proven target snapshot is rejected rather than silently upgraded. Different identity/subject reuse of a request ID is rejected. No new broad client write grants; routine EXECUTE is service_role only, fixed search path and UTC.

## Whole-change review correction: seal joins the fence

The actual legacy seal function can pass its tombstone query, queue a ROW SHARE lock, then queue its INSERT behind capture and commit previously absent session/chunk rows after the immutable capture. The final native review reproduced this with unchanged actual SQL and three real lock waits. Correct it with a new forward migration replacing `seal_recording_manifest(jsonb)`; preserve historical migration bytes and the existing signature, validation, receipt, ACL and replay contract.

Seal must acquire deletion_requests SHARE before advisory/authority/source locks or source reads, require READ COMMITTED for fresh post-wait snapshots, remain VOLATILE and bound lock waits. Both fence orderings and pre-established non-RC snapshot rejection require native complete-row evidence. Earlier passing gate01 remains historical evidence; final acceptance must use the corrected migration graph.

## Application response

Keep the `deletionRequest` response envelope and status 202. Return a closed, validated summary containing requestId as `id`, projectId, subjectId, subjectType, state (`requested` for this capture-only workflow), tombstoneAt, targetCount and `physicalDeletionComplete:false`. Do not expose Storage paths in the public summary. `submitMediaDeletionRequest(input, options)` validates primitive UUID/enum inputs and the entire response, pins request identity, bounds timeouts, disables SDK retries and returns generic categorized errors. Network loss or cancellation never falls back to old multi-write logic. A caller can resubmit and recover the existing capture. The route rejects both assetId and storyId or neither, optional requestId accepts only a UUID, and it forwards auth headers/no-store on every result.

## Backup scope

Both TypeScript and standalone CJS Scheme B validators accept `recording-candidates` in exactly the existing manifest structure. Retain all size, hash, path, duplicate-key and unknown-bucket checks. Test a mixed manifest with original chunks, a published candidate, another retained candidate and a legacy object. A post-freeze tombstone naming the captured candidate bucket/key excludes precisely that object from the computed surviving set. This is manifest and restore-set compatibility; it does not claim object downloads, byte verification, pg_restore success, actual physical deletion, or a qualified backup ledger. Keep that limitation explicit in documentation and evidence.

## Acceptance

1. Native PG17 tests use the actual foundational deletion target DDL and new migration with the existing recording migrations, actual service-role connections and actual application service. Persisted requests/targets equal the expected full source population.
2. Real concurrent transactions cover publication-before-delete and deletion-before-publication, candidate reserve overlap, two concurrent submissions, request-ID collision and current permission revocation while waiting. Assert full rows and actual lock waits, not timings alone. Rejected races may safely abort/timeout; success must capture the committed correct address set.
3. Native failure injection proves target insert, asset update, cancellation update and trigger suppression/tampering roll back all capture writes. Existing data and physical synthetic bytes remain unchanged on rejected requests. Positive replay leaves the complete captured rows unchanged.
4. Unit/API checks cover current authorization, strict inputs/receipts, timeout/abort/lost-result handling and absence of direct application table mutations. The actual confirmation/publication refuses the tombstoned chain. No Storage remove call occurs.
5. Both backup validators and actual CLI accept the candidate manifest, reject malformed entries and compute the same survivor set from captured tombstone coordinates. Record explicit synthetic boundaries.
6. Required final gate: `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`; scoped reviews and whole-change review, final hashes and prior-work integrity are recorded.

## Operating constraints

Use `/Users/eat/Documents/eatpotato/saga传奇` on existing `codex/october-upgrade-p0`; HEAD `c0669e8058343f91deba8e468b03e4bf817b1ca5` and inherited uncommitted work are inputs. Do not stage, commit, push, deploy, apply remote migrations, call paid providers or use family content. Preserve every prior evidence file. Local isolated synthetic databases may be created and removed by their harness. Root ESLint is canonical. Helpers belong outside helper-only `__tests__` files. G1 and push qualification remain false.

Alternatives considered: adding addresses to the old route leaves the read/write race; implementing physical GC in the same batch requires reference fencing and inflight-write reconciliation beyond capture, making it impossible to honestly qualify by a metadata-only test. Durable capture is the prerequisite and the independently testable outcome selected here.
