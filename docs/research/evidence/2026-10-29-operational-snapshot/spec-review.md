# Independent specification review

Reviewer: `/root/ops_spec_review`. The root agent records the returned verdict.

Verdict: PASS for the local database-observation slice; no actionable deviations.

- SQL: no-argument STABLE/SECURITY INVOKER RPC, fixed search path, actual role ACL,
  statement-time aggregate and allowlisted output without private data or identities.
- Semantics: due work and leases, project-level lifetime known exposure, explicit
  unknown costs, invalid metric groups and strict 168-hour deletion boundary match.
- Adapter: schema, numeric and freshness validation, deadline, caller cancellation,
  no retry, fixed errors and no private-row fallback match.
- Route: exact feature flag and server secret precede DB access; every response
  is no-store, and partial metrics cannot authorize cutover or provider probes.
- Independent targeted Jest: 3 suites / 62 tests passed. PG normal/contaminated
  reports each show 15 scenarios / 251 assertions; report and current-source
  hashes and cleanup were verified, including reproducible missing-RPC RED 42883.
- All 1340 protected input hashes matched after the generated next-env restoration.

Review was read-only. This verdict does not approve production G0-G4, external
provider terms, upload/export event coverage, actual alert delivery, PostgREST
integration or large-ledger performance. Final workspace verification and local
checkpoint remain the root agent's responsibility.
