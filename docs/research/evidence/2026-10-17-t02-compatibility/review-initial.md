# T02 compatibility — initial independent review

Date: 2026-10-17

**Verdict: CHANGES REQUESTED — one P2 finding in the local experiment runner.**

This review covers the six files named in `.superpowers/sdd/2026-10-17-upgrade-t02-compatibility/review-brief.md` and the approved T02 implementation plan. All six files are currently untracked, so the supplied `1caa21a72a23d6f5166ed127847ca931374b890a` base yields no tracked diff for them; the current source was inspected directly against the supplied requirements. No source, Git or remote state was changed, and no tests were rerun by this reviewer. Only this review artifact was written.

This is a local compatibility review. It does not establish production readiness, authorization, RLS correctness, object existence or ownership, a complete remote restore, PG17 compatibility, or backup/recovery readiness.

## Standards

No independent actionable maintainability finding was identified in the scoped files. Repository-wide standards and unrelated files were outside the supplied review scope. The small resolver/projector interfaces retain the intended separation between observations and asset identity; neither introduces I/O or production route wiring.

## Spec

### P2 — isolate the in-process PostgreSQL client from host SSL and credential defaults

**Location:** `experiments/t02-legacy-mapping/verify.cjs:13–15,34–36`.

The script removes `PG*` variables from the `env` object passed to `execFileSync`, but that object does not change the environment of the current Node process. The `pg.Client` constructor leaves `ssl` and `password` unspecified, so node-postgres still consults its environment defaults. In particular, `PGSSLMODE=require` makes the connection attempt SSL against the freshly initialized local cluster, which has SSL disabled. A valid host configuration therefore causes this synthetic compatibility rehearsal to fail before its fixture checks. `PGPASSWORD` and password-file fallback can also remain available to the library, contrary to the intended credential-independent runner.

The coordinating task reproduced this during review with explicitly synthetic values, `PGSSLMODE=require` and `PGPASSWORD=synthetic-ignored`. It reported exit 1 with `The server does not support SSL connections` and complete cleanup in [run-1792214637108-52368.json](run-1792214637108-52368.json). This reproduction was supplied by the coordinating task; the independent reviewer did not rerun or separately inspect that report.

**Required change:** explicitly disable SSL for this private Unix-socket fixture and provide a nonempty inert synthetic password (or another configuration proven to avoid node-postgres environment/password-file fallback). An empty password is not a reliable override for libraries that use truthy fallback logic. Add a focused execution with hostile but synthetic `PGSSLMODE`/`PGPASSWORD` values, then regenerate the source-fingerprinted experiment evidence. Preserve the ordinary and signal-cleanup checks.

### Other scoped observations

- Resolver source rejects unverified hosts, unsupported URL routes/schemes, userinfo, bucket conflicts, dot/empty segments, encoded or unsafe keys, and ambiguous raw basenames. It extracts the unnormalized raw path, excludes signed queries from returned locators, and permits an exact root object in a verified full URL.
- Projector source retains source fields and JSON pointers, raw values, duplicate occurrences and array positions. It separates originals, thumbnails and derived audio; preserves invalid elements and unsupported image shapes; blocks incompatible required identity fields; and does not substitute `user_id` for `storyteller_id`. Conflicting or unresolved competing image aliases do not produce a winning locator.
- The runner pins its metadata snapshot, uses selected captured schema definitions, labels the historical `jsonb` array separately, loads the actual TypeScript modules and confines database writes to the temporary synthetic fixture. Its documentation accurately limits the exercised signal case to the stable fixture.
- The reported 2 suites / 40 tests and 17-check local PG14 fixture were inputs to this review, not newly executed review evidence.

## Reviewed source fingerprints

| File | SHA-256 |
| --- | --- |
| `packages/web/src/lib/legacy-media-reference.ts` | `896631ce8e2e32ad2968663d3d97e9701bd3df41367041ab838b6a2acd1af30c` |
| `packages/web/src/lib/__tests__/legacy-media-reference.test.ts` | `e88c50333db66ed7fa997fd092e48e2b2b997ef535059704fb4bb37773e5da94` |
| `packages/web/src/lib/legacy-story-media.ts` | `1fe15dd0e88a62a04b75eab107658ea777c58598639816a6f62646627243158e` |
| `packages/web/src/lib/__tests__/legacy-story-media.test.ts` | `1e2286683a6df63288886f8b631feac2a33cc83f2eb4c0fb9d4eb07499c443e6` |
| `experiments/t02-legacy-mapping/README.md` | `c04abe1643b093d3340828700a03b42b55ec175bafe8e030a828441393a6b5a3` |
| `experiments/t02-legacy-mapping/verify.cjs` | `b101fd568a6235bdd5a11cf3270eee0a9cc0fe8dd77fb1acb032ef7bfb2c8640` |

Standards: 0 actionable findings. Spec: 1 actionable finding, severity P2. The initial verdict should be superseded only by a follow-up review of the correction and its refreshed evidence.
