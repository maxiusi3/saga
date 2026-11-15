# G1 whole-story deletion

User authorization: all human acceptance gates waived; Chrome Web acceptance is sufficient for this local G1 batch. Physical devices and hosted/provider checks remain explicit follow-up items.

The project page submits an authenticated whole-story deletion request. A dedicated service-only SQL RPC captures the existing immutable tombstone/targets, then purges story prose and relational derivatives in the same transaction. Success is **request accepted**, never proof of permanent physical erasure. The original capture-only RPC contract remains unchanged. Replay returns the same capture and repeats the idempotent purge. Media worker identities and storage coordinates remain intact; the story shell retains only identity/linkage and empty content.

Supported media linkage must resolve to captured modern assets. Unknown legacy audio/photo/image metadata fails closed before accepting the new whole-story flow, preserving remediation evidence; the existing capture-only and reference-blocked media path remains available. This limitation belongs in the manual legacy inventory checklist.

Purge covers story content/transcript/AI fields, saved recording intent metadata, interactions, transcript versions/segments/assertions/revisions, search index, agent runs/artifacts/elements and linked interview data, legacy artifacts/archive entries, notifications, public contributions and affected public aggregates, and affected publication snapshots. Shared derived aggregates are invalidated as a whole; unrelated source stories remain intact. Persistent private identity fences prevent delayed service writes from recreating deleted derivatives. Private transaction authorization permits only the purge's narrow story scrub and immutable snapshot deletion; caller-set GUCs provide no authority.

Read protection uses restrictive story RLS plus explicit tombstone filtering in the service-backed project list. Capture and purge use bounded lock acquisition; errors roll back the complete new request. Previously captured requests can be purged independently for restore replay. No remote migration, deployment, paid providers or real family data.

Validation: full bootstrap + all root migrations on actual PG17, synthetic multi-story data graph, accepted/replayed/denied requests, rollback, late writes, immutable capture, unrelated survivor, production ProjectDetailClient/StoryService and actual deletion route in installed Google Chrome. Run npm run verify, shared/infra checks, and complete migration/backup rehearsal after SQL changes.


Implementation review refinements: Wiki clusters carry non-empty active source
contribution IDs on the first write, closing the cluster-before-link race.
Withdrawal may invalidate only status/updated_at or remove all content with the
fixed empty-cluster transition; it cannot smuggle content. Snapshot matching also
includes exact asset IDs from captured targets. New recording interventions carry
a local session ID, resolved only through matching project/actor save intents;
historical sessions without a recorded relation remain explicit manual mapping.
The shell retains identity/linkage plus timing/duration metadata, not prose; media
original_filename and processing coordinates remain for reconciliation.
