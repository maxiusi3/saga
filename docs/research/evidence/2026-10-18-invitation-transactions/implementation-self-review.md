# Implementation self-review — Task 1

This is the implementer's self-review, not the independent spec/quality review. The controller owns independent review and the final upgrade gate assessment.

Reviewed the complete binding spec against the candidate SQL, protocol module, snapshot scenarios, concurrency harness, input closure and lifecycle observer. The review focused on current locked authorization, request alias payload matching, immutable invitation fields, typed resource/log associations, exact terminal transitions, rollback coverage, and the difference between synthetic fixture trust and production identity/payment evidence.

## Reproduced finding and correction

The first implementation used `FOR UPDATE` on the current caller's auth row. Across projects, acceptance can hold the original payer's wallet while a new send holds the payer's auth row. The acceptance member/log foreign keys subsequently request `KEY SHARE` on that payer. This creates a real lock inversion.

A fixture-only BEFORE INSERT gate exposed the moment before the FK checks. Three real connections observed an advisory insertion wait and a wallet transaction wait through `pg_locks` and `pg_blocking_pids`. After releasing the gate, PostgreSQL actually reported `40P01` for the independently funded send. Its transaction wrote nothing. This was saved before the correction in [the failed run](invitation-run-2026-10-18T07-11-23.863Z-5fc1922b-5f9d-4f46-a5f8-a6a8fcedd67b.json); it is not a passing result or a claim about the original public RPC.

The current auth lock is `FOR NO KEY UPDATE`. It still excludes email/confirmation changes and deletion, while allowing the later FK key-share checks. The final regression requires both funded operations to succeed. Existing two-order identity/source/member/project mutation tests still pass; additional auth-deletion tests prove real lock exclusion and retained accepted-identity FK protection. The temporary insertion-gate trigger/function are fixture-only and are dropped on success or failure.

## Additional verification corrections

- Initial candidate DDL attempts exposed a PL/pgSQL CASE-expression syntax error. Those failed reports remain intact and are not the missing-feature RED.
- The first concurrency observer queued a PID query on a busy connection and consequently saw an aborted transaction. PID acquisition now happens before each operation starts; the observer uses its separate admin connection for locks. The failed report remains intact.
- The stronger send-history assertion initially omitted the captured wallet `updated_at` trigger's intentional timestamp change. It now restores only that bookkeeping field and the one consumed role seat for full-history comparison. It does not whitelist unrelated wallet changes.
- Email validation rejects non-ASCII before lowercasing, avoiding any accidental Unicode case-fold acceptance.
- Final JavaScript was formatted for reviewability, then pins, the protocol test, the full normal run and the complete hostile/lifecycle run were repeated on that byte set.

## Reviewed invariants and limits

- SQL-generated versioned tokens never appear in public evidence. No legacy invitation or member adoption exists.
- Same request keys retain their original normalized payload and invitation. Pending target aliases require the same source and message. A cross-project changed-payload race rejects without extra writes.
- Source and original-wallet reservation/refund are atomic; typed bindings validate reserve/activate/release facts. All specified real CHECK-failure injections and caller/DDL rollbacks use complete related-table snapshots.
- Accepted member mappings remain durable after revocation/deletion; retry never restores access. Current facilitator cleanup after transfer refunds the original payer and source, including a revoked source.
- Actual committed send and accept responses are discarded before read-only lookup/status recovery. Protocol mocks alone are not used as proof of durable recovery.
- Both previously reviewed export overloads are composed in the isolated suite. Candidate SQL itself leaves original public RPC definitions unchanged.
- Final suite source pins cover 24 direct inputs, 44 loaded CommonJS/package files, the Node executable and 743 installed PG bin/lib/share files. macOS system libraries/kernel remain ambient dependencies.
- Synthetic identity, local ACL/RLS materialization and the source port do not verify real JWTs or payments. Original public RPC bypasses, production adapters/entry points, migration/rollback, backups, delivery and device evidence remain outside this batch. No original milestone or production readiness is claimed.

No additional implementation defect was found in this scoped self-review. Exact final evidence, source hashes and intermediate classifications are in `implementation-verification.json`; independent review remains the controller's next step.
