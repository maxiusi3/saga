# Local invitation management read ports

Synthetic PostgreSQL 17.4 overlay only. This directory composes the unchanged
routine replay and trusted entitlement event experiment in a fresh Unix socket
cluster. It is not a production migration or real provider qualification.

Run `node experiments/pg17-invitation-management/verify.mjs --red` to demonstrate
that the composed baseline lacks both ports. The expected exit is 1. Run the
same command without `--red` for the candidate and `verify-lifecycle.mjs` for
hostile PG environment, actual SIGTERM, failed server start, and failed connection
cleanup observations. Reports use unique `sql-*` files in the dated evidence
directory. Only hashes, safe labels, SQLSTATEs, and counts are persisted; query
rows and error messages remain private in memory.

Installation requires both database `saga_pg17_rehearsal` and independent
`saga.invitation_management=only_synthetic_local`. New routines belong to
`fixture_owner`, have empty search paths, and expose EXECUTE only to authenticated.
No direct table grants are added. Both ports are STABLE and perform no writes or
row locks. They read one statement snapshot; a displayed source is not reserved,
and the unchanged sender rechecks authority atomically.

`available_sources(p_project_id uuid,p_role text)` returns source_id, project_id,
role, remaining, ordered by source UUID with a hard maximum of 100. It requires
the confirmed current facilitator of an active project, a role-matched verified
unrevoked positive source with a matching durable grant event and purchase audit,
and a positive wallet mirror. Storyteller membership/reservation conflicts hide
all storyteller choices.

`management_list(p_project_id uuid,p_after uuid DEFAULT NULL)` returns only
invitation_id, project_id, invitee_email, role, status, expires_at, created_at,
request_id. It validates all bound project history before returning at most 50
UUID-ordered rows after the cursor. Transfers, inactive projects, revoked sources,
and inactive/deleted accepted members remain historical facts. Existing member
identity mismatches or binding/invitation/audit corruption refuse the whole read.
Unbound legacy invitations are never adopted. An actor sees only their own request
mapping; when that actor has aliases, the smallest request UUID is deterministic.

UUID argument typing rejects invalid UUIDs; canonical textual UUID validation is
the HTTP boundary's responsibility because PostgreSQL uuid values do not retain
their input spelling. The existing fixture models auth.uid claims, not actual
Supabase Auth/PostgREST; no remote migrations, real users, payments, or provider
requests run. Old experiment and evidence inputs are byte-fingerprinted before
and after each execution. Shared runtime installation bytes are also verified
against the existing trusted event pins. Ambient OS libraries are not pinned.
