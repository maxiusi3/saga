# Task 1 collector spec review

**CHANGES REQUESTED — one P2 finding.** Reviewed the frozen implementation and saved baseline on 2026-10-17. Scope is the collector and its tests, before the controller's real read-only capture; no routine semantics or production permissions conclusion is made.

- **[P2] Isolate the local PostgreSQL fixture from inherited configuration.** In [the local test](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L38), `spawnSync` has no explicit environment; its [Client configuration](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L58) leaves `ssl` and `password` unset. This misses the assigned process-environment isolation requirement and the brief's “Do not read actual credentials” boundary; the [plan](../../../superpowers/plans/2026-10-17-upgrade-routine-audit.md#L13) requires an independent Unix-socket fixture. The installed `pg` resolves omitted fields from `PGSSLMODE`/`PGPASSWORD`, so a caller's PostgreSQL configuration or password enters this supposedly synthetic test, and inherited TLS settings can prevent its local connection. A connection-free child process, with an environment containing only `PGSSLMODE=require` and `PGPASSWORD=SYNTHETIC_ONLY`, constructed the same Client configuration and returned `{"sslInherited":true,"passwordInherited":true,"hostIsSocket":true}`. No actual credentials or socket were accessed. Use a sanitized/allowlisted environment for the local worker and subprocesses, set `ssl:false` and a nonempty inert password, and add an inherited-environment regression before refreshing local evidence.

No other material spec gap found in this scope. Independently checked:

- Snapshot bytes match SHA-256 `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e`; the loader selects exactly 12 pinned identities. Parameterized catalog SQL, attribute/MD5 validation, drift and missing-result handling remain restricted.
- Public serialization uses pinned identities, hashes, statuses and approved codes; raw definitions/default literals stay in the private capture, including drift. Private creation checks ordinary directory chains, exact 0700/0600 modes, exclusive/no-follow creation and subsequent identity/permission checks.
- Shared role/TLS/read-only transaction/10s–2s–15s limits and 90s asynchronous driver deadline preserve the baseline logic. All 16 metadata query strings and export keys equal the saved baseline; original test assertions remain unchanged apart from VM wiring. The sole ignore delta is `/supabase/.temp/routine-audit/`.

Reviewed existing coverage for malformed/partial results, privacy, file safety, connect/query/rollback/end hangs and cleanup failures. Existing TAP reports 43/43 including PG16.11; this review did not rerun that suite. Only the synthetic constructor reproduction and read-only comparisons were executed. No credentials, network, business routines, dependencies, commits or implementation files were touched.

## Reviewed file fingerprints (SHA-256)

| File | SHA-256 |
|---|---|
| `scripts/inspect-supabase-routines.cjs` | `f838b8762324302073bdfc657551069666357b9a2bd66299a3fe2f6ec4d4f928` |
| `scripts/supabase-capture-runtime.cjs` | `6b6e2ed78758076af37cb6fa2383d61f0e07090b32d44288b3abe46c6e15353a` |
| `scripts/inspect-supabase-metadata.cjs` | `be8f08d62a6ac3fcae20911f8b6569dab8f6a52bb2e099a233855ac63f8e27d2` |
| `scripts/__tests__/inspect-supabase-routines.test.cjs` | `0bd3c95ca57d60566ca0bf3df46d33866f03f03d005d81b0d42b9ad0b6adbdc8` |
| `scripts/__tests__/inspect-supabase-routines-local.test.cjs` | `77626e450bd96402d324d02e074501f8ed6a28ee779bc1df453bf7cd8c564936` |
| `scripts/__tests__/inspect-supabase-metadata.test.cjs` | `772cf50cb7fa3d5cfbc9c07400a842b5dbe9039db37f83504a64d0e00406686a` |
| `.gitignore` | `d32441029111fe11e841724d2cc515f05029d6d46160336239acd0c034d1ef67` |

Saved metadata baseline SHA-256: `df6493a88f861f720ba105efdf38aef34cb4e01a0cb3732cdd447f3f95670615`.
