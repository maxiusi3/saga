# Media deletion worker

The online worker consumes immutable deletion captures and uses a separate execution ledger. It deletes exact objects through Supabase Storage, preserves per-operation evidence, and repeatedly checks for API-visible late arrivals. The media worker preserves tombstoned identities for replay. The separate whole-story request RPC clears current story text and relational derivatives atomically with capture; restored historical text must be purged again before access is reopened.

## Run

Apply repository migrations through `20261109000002_story_content_deletion.sql` in the intended environment through its normal release procedure. This batch only applied migrations to isolated local databases.

Set `SUPABASE_URL` (an HTTPS origin) and `SUPABASE_SERVICE_ROLE_KEY` explicitly in the worker environment. The CLI does not read `.env` automatically. `MEDIA_DELETION_POLL_MS` is optional, default 2000, range 250–60000.

```sh
npm run worker:deletions -- --check  # compile/check locally; no network
npm run worker:deletions -- --once  # inspect at most one request
npm run worker:deletions           # serial fair scan; SIGINT/SIGTERM stops it
```

Run a persistent process supervisor for continuous operation. Successful, blocked and failed requests become due again after five minutes. Run ownership expires after 120 seconds; accepted object actions renew a live run. Selection advances a UUID cursor so one problematic request cannot permanently hide later requests. Logs contain fixed state labels, never credentials or object content.

The request route still returns `202` and a durable tombstone immediately. Its capture receipt is not a physical deletion success receipt. Existing `media_deletion_jobs` leases retain their original ownership-only contract. Physical dispatch requires a separate running execution, a fenced address and a fresh present observation in that run.

## Read results

Service-role read access is available to `media_deletion_executions`, `media_deletion_objects`, `media_deletion_fences` and `media_deletion_events`. Writes are restricted to the execution RPC. Application clients cannot read private object paths or forge results.

| State | Meaning | Follow-up |
|---|---|---|
| `scanning` | A leased worker is inspecting/deleting the captured scope. | Wait for this run or lease expiry. |
| `observed_absent` | At the recorded time, every known object was absent from the Storage API, the final session-prefix inventory was empty, and no known physical dispatch was unresolved. | Continue periodic scans. This is not proof of permanent backend erasure. |
| `reconcile` | Interrupted I/O, unresolved deletion result, or another incomplete check. | Worker continues observations. Inspect `unresolvedPhysicalCount`/`physical_uncertain` and event history. |
| `blocked_reference` | A live outside reference or uncaptured legacy reference prevents safe deletion. | Reconcile the reference mapping; remove an outside reference only through its authorized workflow. |

A lost/failed delete, or `not_found` after a present observation, remains a sticky physical unknown. A later API 404 cannot clear it. An abandoned `dispatching` object is marked unknown on the next run. New destructive calls require a new present observation; the old dispatch is never blindly replayed. Unknown results require provider-side object/version inventory and cleanup evidence; this worker has no automatic “trust me, complete” override.

## Boundaries

Supabase Storage metadata and backend bytes are separate. The public Storage API cannot discover a backend object that has no `storage.objects` row. It may also return 404 after metadata deletion even when backend cleanup failed. Thus `physicalDeletionComplete` stays false, including after a successful scan. Recurring cleanup covers API-visible late writes; provider-only orphan discovery, underlying versions, backups and retention qualification remain separate operations. References: [Storage schema](https://supabase.com/docs/guides/storage/schema/design), [Storage object implementation](https://github.com/supabase/storage/blob/master/src/storage/object.ts).

Permanent object/session-prefix and identity fences reject resurrection and new references, including service-role writes. They prevent namespace reuse after deletion. The capture-only API preserves content; the project page whole-story API clears content while retaining the story identity, media coordinates and replay metadata. Neither path claims whole-database personal-data erasure. Legacy URLs/images without validated captured coordinates deliberately block deletion. Modern `/api/media/assets/<uuid>/play` references are resolved as asset references, and unrelated modern recording saves continue working.

## Local verification

```sh
node experiments/pg17-deletion-execution/verify.mjs --chrome
node experiments/g1-local/verify-migrations.mjs --backup
npm run verify
npm test --workspace=packages/shared -- --runInBand
npm run test:infra
```

The native test uses actual PG17, compiled production worker/routes, installed Google Chrome and real disk files. Auth/PostgREST/Storage HTTP are explicit synthetic adapters. The Storage fixture keeps metadata and physical bytes separate, including a failure that leaves an invisible raw orphan. Local pass is not hosted Supabase qualification.

## Whole-story requests and restore replay

The actual project page calls `POST /api/projects/<projectId>/stories/<storyId>/delete`.
The service-only `request_story_deletion` transaction checks current owner/active
facilitator, calls immutable capture, and purges current text/relational derivatives.
Unknown legacy media references fail the whole transaction, retaining mapping clues.
202 means accepted; physical deletion remains separate. `story_content_purges`
records successful database content purges. The original media capture endpoint
keeps its existing semantics.

After restoring a pre-deletion backup, replay exact captures and targets, mark the
assets deleting, and call `purge_story_content(request_id)` for each story capture
before reopening access. Do not mutate the capture to indicate completion.
The same request can be replayed after content removal. Historical interviews with
no persisted source relationship require mapping; new recording interventions
carry their recording session ID and are scoped through the matching save intent.
See [the whole-story report](research/2026-11-09-g1-story-deletion.md).
