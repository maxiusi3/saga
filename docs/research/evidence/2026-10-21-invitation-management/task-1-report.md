# Task 1 — restricted SQL read ports

Implemented in isolated `experiments/pg17-invitation-management/`: `candidate.sql`, `scenarios.mjs`, `verify.mjs`, `verify-lifecycle.mjs`, and `README.md`. No existing experiment, frozen evidence, root migration, dependency, or shared application file was edited. No commit, deployment, provider call, or worker subagent.

The candidate composes the unchanged trusted entitlement runner and adds `available_sources(uuid,text)` and `management_list(uuid,uuid DEFAULT NULL)` as STABLE SECURITY DEFINER routines owned by fixture_owner with empty search paths. Only authenticated receives EXECUTE; private confirmation/source helpers and all direct tables remain closed. Installation requires the exact local database and independent management marker.

Sources require a confirmed identity with parseable email, current active-project facilitator authority, matching actor/role, verified and unrevoked positive availability, positive wallet mirror, and an actual grant event plus its matching purchase audit. Legacy balances and bare fixture-manager source rows create no authority. Storyteller members and reservations suppress storyteller choices. Output has four fields, UUID order, maximum 100.

Management validates the complete bound project history in one statement snapshot before pagination. It checks invitation/binding payload, reserve/activate/release audits, source provenance, and request mappings. It omits unbound opaque invitations and tokens/content/provider identifiers. Current facilitators can clean up inactive/transferred/revoked history; request IDs are shown only for the current original actor, deterministically choosing the smallest alias UUID. Inactive/deleted accepted members remain history; surviving member identity mismatches refuse the read. The page is UUID-keyset ordered, maximum 50, with exact eight-field projection. No read locks/writes; unchanged sender/release routines remain the write authority.

## Evidence

All files are unique under `docs/research/evidence/2026-10-21-invitation-management/`.

- Expected baseline RED: `sql-red-2026-10-21T14-32-21.737Z-fabdacdf-02aa-4893-b9ca-f4c3eec33d97.json`, both ports absent, exit 1 at required-read-ports assertion; 1693 assertions including composed baseline setup; cleanup complete. SHA256 b25ed8fafd841958c470719b6707b3a7f9897b9decb09e071739efd3f411491d.
- Final candidate: `sql-run-2026-10-21T14-47-16.084Z-8e804a59-f438-4c16-b9c8-3559d2bc64af.json`, exit 0, 16 scenarios and 2448 assertions. Before/after prior pinned input fingerprints match; complete cluster/client/temp cleanup. SHA256 177a479669d23fcaaed154308769ce25346eea9b7b9f6622cc0ec20da596a883.
- Final lifecycle: `sql-lifecycle-2026-10-21T14-49-45.910Z-877999de-cb4b-4603-9b9e-9af16843648d.json`, exit 0, all four observer cases pass: hostile PG environment, actual SIGTERM after fixture ready, actual failed server start, and actual failed client connection. Child evidence paths and digests are recorded by the observer. SHA256 b858c6cea49dcab8421c65ec9a8e6e7662947c33fb3315f3b519c7bb36b6751b.
- Earlier intermediate candidate failures remain preserved: `14-37-58.920Z` exposed a test-fixture visibility error (uncommitted admin damage invisible to separate actor connection); fixed by committing synthetic mutations then explicitly restoring them. `14-40-09.666Z` exposed schema-USAGE restriction in the ACL introspection test; fixed by resolving function OIDs as admin and checking the actual low-privilege callers using OIDs. Neither failure was concealed or overwritten.
- Earlier passing intermediate runs and lifecycle evidence also remain untouched.

Coverage includes actor/role/confirmation/source provenance and flag/depletion filters, wallet-only exclusion, wrong role/project/foreign actor, storyteller membership/reservation, source revoke, inactive/transfer release, accepted inactive/deleted membership, damaged binding/invitation/request/audit/source refusal even beyond the current cursor, expiry release history, maximum counts/order/keyset continuation, duplicate installation/marker/database boundaries, actual anon/authenticated/service/metadata/writer connections, exact ACL/owner/search_path/STABLE metadata, direct-table/private-helper denial, read-only transactions and default cursor, and complete business-table no-write snapshots for successful/refused reads.

## Limits and handoff

PostgreSQL UUID values discard textual spelling; canonical textual UUID validation belongs to HTTP. The fixture models auth.uid claims and real low-privilege database sessions, not actual Supabase Auth/PostgREST. Runtime bytes and prior input pins are verified; ambient OS libraries are not byte-pinned. Management snapshots do not reserve sources; original send reauthorizes under its transaction locks. This local synthetic result is not production, provider, Auth, migration, or device qualification.

Independent review is in progress with management_review; parent owns shared verification and documentation updates.

## File fingerprints

- README.md: b0cab9d09a2a7992d1526218dd25ab105c7692bdffb69938cf2fe47e92d7cee3
- candidate.sql: e2063af8a44dbbf045ec1c47aae210a7a070629c17c0702093e391b7150c8c9a
- scenarios.mjs: 6dabb172500007151e934819e3605cb67d0672af833d293c15a5965d94e44bea
- verify-lifecycle.mjs: 2221b6d5ece337b90a981fcb1d1c61ef3c2f57ac8253ad34d8824c8379c6dc5b
- verify.mjs: 7849a2b701e50977546de64d46c03edf9b802e94b40b55ca6ad12f056a802eb2

All three JavaScript entry/scenario files pass `node --check`. Safe report scan finds zero synthetic email values, token values, URI credentials, or hostile password values in any sql-* report.
