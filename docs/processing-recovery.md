# Publication and transcription recovery

The 2026-11-13 repair adds forward migration `20261113000001_processing_recovery.sql`. Apply it with the normal reviewed migration chain before running the updated transcription server. This batch does not deploy or migrate a remote database.

## Publication ZIPs

The delivery worker treats a failed `finish` response as an unknown database outcome. It reads the job again with a five-second deadline and SDK retries disabled. A successful reconciliation requires the same job and lease token, `ready` state, byte length and SHA-256 recorded for the ZIP just assembled. The worker then reports `ready` and preserves the ZIP.

If reconciliation also fails, the worker reports `unavailable` and retains the attempt directory. The next worker invocation runs spool reconciliation before claiming a job. Each reconciliation captures attempt directory names before reading the current database row. It only cleans captured attempts; newly created directories are outside that cleanup pass, and a missing row permits only nonrecursive removal of an empty job root. A current `running` or `ready` lease retains its attempt; attempts with a different token or confirmed failed/revoked/absent job may be deleted. A cleanup-queue item does not authorize deletion of a newly referenced ZIP: stale queue entries reconcile individual attempts before acknowledgement.

Temporary PDF/media cleanup is separate from publication completion. Cleanup failure after `ready` leaves the successful result intact; a later reconciliation removes those temporary files. A pre-commit failure may call the existing lease-checked `fail` RPC. The attempt is removed only after an acknowledged failure or a fresh database read proves it unreferenced. A query error is never proof that a job is absent.

Keep the private persistent spool mounted to both worker and download hosts. Investigate repeated `unavailable` results and restore database connectivity/permissions; do not manually remove the retained ZIP to make the warning disappear. Existing authenticated download validation and deletion tombstone replay still apply.

## Transcription phases

The reservation table now records `execution_phase`, a preparation lease token/deadline, attempt count and outbound start time. It stores request/source identities and policy metadata, not a copy of audio or transcript prose.

| Persisted state | Permitted action |
| --- | --- |
| Legacy `unknown` | Keep pending; never infer that an older worker did not send. |
| `preparing`, live lease | One worker may download and validate the audio. Other requests remain pending. |
| `preparing`, released or expired lease | The same actor/request and unchanged metadata may explicitly retry with a new token, up to five preparation attempts. |
| `outbound` | Never issue another outbound permit, including after timeout, error, process death or a lost permit response. |
| `completed_at` present | Read the committed review without sending audio again. |

The preparation lease lasts 120 seconds. Storage503, checksum failure or another confirmed pre-send error calls the service-only release operation. The operation checks persistent phase and token; a stale process cannot release a newer lease, and an outbound attempt cannot be released. If the process dies or its reservation response is lost, expiry provides the same safe recovery path.

The service-only begin operation rechecks membership, deletion state, consent, source hash, asset identity, current revision/edit version and the story audio pointer, then atomically grants exactly one outbound permit. A lost acknowledgement does not authorize sending. The ingestion wrapper requires the matching outbound token, retains the existing source/consent/CAS checks, and checks the audio pointer again. The private prior RPC implementations are not callable by `service_role`, authenticated clients or anonymous clients.

`GET /api/stories/:id/transcribe` adds `retryableRequestId` only for the current actor's valid, released/expired preparation whose current story audio pointer still identifies the reserved asset. A cleared or replaced audio pointer never advertises retry. After reloading, the story panel offers **Retry transcription** and requires consent again. That button sends the same request ID; changing request ID does not bypass the outstanding request or reset the five-attempt budget. No retry runs automatically. Unchanged source, policy and request metadata remain required.

Outbound/legacy unknown attempts and exhausted preparation budgets remain pending and require investigation. This repair does not guess provider outcomes, claim provider-side cancellation or expose an administrative force-resend operation. G1 story deletion continues to erase the reservation rows, including the new recovery identities.

## Local verification

Run the focused native rehearsal with:

```sh
node experiments/pg17-processing-recovery/verify.mjs
```

It creates a temporary PostgreSQL17 cluster with the complete repository bootstrap/migration chain through recovery migration `00001`, uses actual Supabase SDK requests against declared loopback transports, and shuts down/removes the cluster afterward. Independent repair migrations `00002` onward are exercised by the parent's full-chain integration run.

The scenarios cover preparation crashes, metadata/permission/consent/deletion changes, source-pointer changes at commit, five-attempt limits, concurrent permits, lost reservation/outbound acknowledgements, Storage503 retry, provider503 with no resend, and completed replay. Publication scenarios assemble real PDF/ZIP files, drop actual committed SQL responses, deny reconciliation, induce filesystem cleanup failure and verify ZIP CRC/size/hash retention.

Evidence is recorded under `docs/research/evidence/2026-11-13-audit-repair/recovery/`. The loopback provider receives synthetic bytes and returns controlled timed words. These runs prove engineering behavior; they do not qualify real ASR accuracy, account policy, remote Supabase behavior or a deployed worker.
