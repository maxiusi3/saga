# G1 online media deletion and reconciliation

The user authorizes continuing G1, local synthetic test environments and Chrome automation. All human-operated acceptance gates are waived/deferred by the user on 2026-11-09. Remote deployment, remote migration and paid providers remain outside this batch. Preserve the inherited dirty checkout and previous evidence.

## Contract

Keep deletion_requests and deletion_targets immutable and replayable. A separate execution record binds their complete JSON digest. Existing ownership-only leases remain ownership-only; the first execution uses that ledger for bootstrap coordination. New recurring scan leases and per-object events provide actual physical operation authority and durable outcomes.

At each first plan, take the same deletion-table fence followed by population locks. Discover selected assets and their sessions from immutable targets. Reject aliases, unselected derived children, foreign/session rebinding, and unresolved legacy media references. Preserve metadata identity and tombstones for replay. This worker purges Storage objects; retained database content and immutable historical publication snapshots are not claimed erased.

Install permanent exact-object and recording-session-prefix fences plus asset/session/story identity fences. Database triggers prevent new references, rebinding, resurrection, and Storage metadata insertion/update at fenced addresses, including service-role writes. Canonical session prefixes discover uploads that were never sealed into recording_chunks. Candidate addresses are already reserved before upload, so exact capture plus candidate-reference fencing covers them. No wildcard project/bucket delete.

A serial recurring worker obtains a 120-second run lease. Every RPC verifies the capture digest and current run; calls renew only a live lease. List each canonical session prefix completely, persist newly observed numeric chunk paths in the separate object ledger, then inspect each exact object. A fresh present observation in this run is required before persisting a uniquely identified delete dispatch. Record deleted/not-found/unknown results and separately verify absence. A crash, timeout or lost result is never inferred as success: the next run observes Storage before any new dispatch. Permanent fences make delayed old deletes safe against namespace reuse. Stale result commits fail.

Finish only after a complete prefix inventory and absence observations for all recorded objects in the same run. Report `observed_absent`, `lastVerifiedAt` and a next reconciliation time; keep recurring monitoring even after success. A Storage metadata guard cannot prove that an underlying object server will never finish a previously accepted write. Accordingly no API returns an unqualified permanent `physicalDeletionComplete:true`. The acceptance claim is actual Storage-API deletion with durable results and recurring cleanup of API-visible late writes. `observed_absent` is explicitly a Storage-API namespace observation. Backend-only orphans without metadata are not discoverable through GET/list; provider-side inventory/cleanup remains unqualified. Known uncertain dispatches stay sticky across later 404s, including not_found after a prior present observation. A Storage failure remains `reconcile`, with durable operation evidence and a due retry. A conservative legacy-reference conflict blocks physical I/O and is visible as `blocked_reference`.

## Files and validation

- Forward SQL migration: private execution, fence, object and append-only event tables; one service-only RPC; reference/write guards; no client mutation grants.
- Server modules: bounded RPC transport, strict plan/receipt/address validation, Storage HTTP observation/list/delete and recurring host. CLI compiles the actual TS graph and uses explicit operator credentials; no implicit dotenv.
- Native PG tests: reference races, ACL/RLS, late prefix object discovery, immutable capture replay, stale owner, incomplete inventory, delete response loss, crash/restart, physical bytes and retained unrelated object.
- Chrome: invoke actual delete request route using a local test UI, run actual worker, show persisted state, verify denied deleted playback and preserved unrelated media.
- Full bootstrap/migration chain, `npm run verify`, shared and infra tests. Archive results/source hashes; update live G1 status and human follow-up checklist without rewriting historical evidence.

## Review adjustments implemented

Resolve modern asset playback URLs instead of treating every nonempty URL as unknown legacy. Block uncaptured legacy media in the selected story too. Guard capture targets before first plan to prevent asset/story/session rebinding. Permit removal of outside references without permitting movement of captured identities. After own deletions rescan each prefix from offset zero until empty. Failed, lost, recovered or post-presence not_found dispatches keep a physical uncertainty flag. The local HTTP fixture separates metadata and disk bytes and proves that 404 cannot clear that flag.
