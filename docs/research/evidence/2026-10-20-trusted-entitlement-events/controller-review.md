# Controller review — independent subagent review pending

Review type: controller inspection of implementation authored by the implementation agent. This is **not** the required fresh independent subagent approval. Repeated independent reviewer dispatches failed from gpt-6-astra token rate limits; advertised gpt-6.1-sol/gpt-6-sol overrides returned model_not_found. No reviewer verdict was received.

## Checks performed

- Read candidate.sql in full. The only writer entries are apply_event/lookup_event (lines 63, 146, 153–154); payload validation and immutable event/source checks are at 70–86. Grant, terminal tombstone, current-state lookup and relational provenance are internally consistent with the bounded local specification.
- Reviewed project discovery and lock ordering (candidate.sql:88–107) against imported invitation wallet/source locking and the actual concurrency schedules. Discovery is rechecked after wallet serialization; concurrency.mjs:300–358 executes a committed new-project race, obtains 40001 with unchanged committed state, then retries and deactivates both mappings. All 20 schedules in the final report have observed lock evidence.
- Reviewed member revocation (candidate.sql:126–141), both export-denial checks and preserved independent ownership (scenarios.mjs:733–894). Mismatched mapping rolls the whole event back; inactive/deleted mappings are not recreated. This does not revoke independent project ownership, issued URLs or already-submitted export jobs.
- Reviewed candidate table/column and seven exact unsafe RPC ACL closure (candidate.sql:155–178), real-role/GUC/SET ROLE attempts (scenarios.mjs:554–715), installation/DDL rollback and repeated application (485–552), write-stage fault injection (896–972), and default future-function ACL behavior (975–994).
- Read verify.mjs, input-files.mjs, fixture.sql and lifecycle observer. The runner scrubs remote PG variables through the unchanged Harness, starts only a private Unix-socket PG17 cluster, fingerprints source/runtime/dependencies, and closes clients/cluster in finally. The observer checks actual process/directory absence and expected exits, distinct from normal business-test success.
- Controller independently recomputed all 25 direct source, 44 loaded CommonJS/package and 743 runtime-file hashes against input-pins.json. Reviewed the retained normal 95/3211 and lifecycle 4/4 raw results. Fresh application checks were run by the controller: verify/shared/infra exit 0, Web96/1278, shared4/16, infra7,176 pages;773 application inputs unchanged and next-env restored.

## Findings and limits

No actionable code defect identified in the inspected scope. This provisional controller assessment does not close the independent task or final-batch review checkboxes.

The ACL RED deliberately uses a synthetic permissive table/column/RLS fixture (fixture.sql:10–14); it proves the candidate closes that path, not that the same column grant exists in production. The other RED is a genuinely missing local event interface (42883), not a payment-provider defect. Preserve these distinctions in the handoff.

Remaining release barriers include true provider signature/account/product verification, production roles/JWT/RLS/PostgREST/Storage, history migration/backfill/rollback and backup recovery, selected service conditions, and devices. Historical audit42 (34high/8moderate) and existing build configuration diagnostics remain open. No deployment or push qualification follows from this review.

## Resume

Use task-1-brief.md, task-1-report.md and task-1-review-package.diff in this plan's scratch directory for a fresh independent reviewer. Resolve findings with the original implementation agent and scoped tests; do not replay successful unchanged suites solely because a reviewer was unavailable. Then independently review documentation/final batch, update summary status/plan and handoff, and recheck integrity.
