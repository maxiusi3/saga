# T02 compatibility — independent P2 follow-up

Date: 2026-10-17 (Asia/Taipei)

**Verdict: scoped PASS. The single P2 in [review-initial.md](review-initial.md) is closed. No new actionable finding was identified in its correction.**

## Scope and method

This independent follow-up covers only the initial P2 concerning ambient SSL/password defaults in the in-process PostgreSQL client, the corresponding configuration in the RLS runner, and the refreshed evidence referenced by [verification.json](verification.json). It reads [review-status.md](review-status.md) and the [T02 research record](../../2026-10-17-t02-legacy-mapping.md) as historical context. It does not repeat the original resolver/projector review, broaden the RLS review, or review the historical dirty worktree.

The reviewer inspected current source and the installed pg 8.16.3 fallback implementation, read the saved reports, and independently recomputed their SHA-256 values and source/snapshot fingerprints. No test, fixture, remote command, migration, commit or push was run. Only this review artifact was written; the initial review, prior verification summary and handoff were preserved.

## Correction assessment

- `experiments/t02-legacy-mapping/verify.cjs:34–43` supplies `ssl: false` and the nonempty inert password `synthetic-local-unused` directly to every `Client`. After each real connection, it asserts both resolved connection parameters. Its two connections account for the increase from 17 to 19 recorded checks.
- `experiments/rls-rehearsal/verify.mjs:310–319` supplies the same options in its common configuration. The sole client factory at lines 126–142 spreads that configuration and only replaces `database`, so admin and actor connections retain both overrides.
- In installed pg 8.16.3, `connection-parameters.js` reads `PGSSLMODE` only when `config.ssl` is undefined. Its password selector uses `config.password || environment || defaults`, so the nonempty synthetic value wins. `client.js` copies that value and calls the pgpass fallback only when the password is null. The correction therefore addresses the initial concern about both environment defaults and password-file fallback; an empty password would not provide the same guarantee.
- Both runners still connect through their explicitly selected private Unix socket to a temporary cluster with TCP disabled and trust authentication. The inert password is unused by that fixture. Disabling SSL is appropriate for this local setup and introduces no production connection change. The inspected correction does not change fixture content or teardown control flow.

The preserved RED report [run-1792214637108-52368.json](run-1792214637108-52368.json) records `The server does not support SSL connections` before any fixture checks, with complete cleanup and the initial runner hash `b101fd568a6235bdd5a11cf3270eee0a9cc0fe8dd77fb1acb032ef7bfb2c8640`. Its SHA-256 is `7fa914e46bfbacd67f1540878089c16bbf7b16cabfd2519e0baa8f5f3a980307`.

## Refreshed evidence checked

All five report hashes below match the referenced verification summary. Every source fingerprint embedded in these reports matches the current corresponding file; the recorded metadata snapshot hash also matches the saved snapshot. Each T02 report includes the same six current source fingerprints. The ordinary and hostile-environment runs each record both SSL/password assertions.

| Saved report | Recorded result | Independently recomputed SHA-256 |
| --- | --- | --- |
| [T02 normal](run-1792215305355-53519.json) | passed; 19 checks; summary exit 0 | `15a5f4bd0042d0c4e512567c1945d0b250966826ba2be303f1fa5b52a99e1308` |
| [T02 host environment](run-1792214844943-52595.json) | passed; 19 checks; summary exit 0 | `fc32e5f648bc05f6a5f44a9f1e2ea48ad912f06fb9062836052a87cf0106d937` |
| [T02 stable-fixture signal](run-1792215196345-53374.json) | interrupted at `synthetic_fixture_ready`; SIGTERM; 3 checks; summary exit 143 | `12ca4af231dd8768267cf9656c4e8c65d5a4930503497c39f652180687ac31ea` |
| [RLS host environment](../2026-10-17-rls-rehearsal/run-1792214844651-52596.json) | passed; 63 scenarios / 351 assertions; summary exit 0 | `786f647c3682d31bd05f0944b740a0b48de532bc134ed5102d3f489a040b421b` |
| [RLS shutdown regression](../2026-10-17-rls-rehearsal/shutdown-regression-1792214844605-52597.json) | all 6 cases passed; summary exit 0 | `48af716ece774c062f42077a2fe94fced7f3dd3076a3e99507456222be160bcd` |

The T02 reports and RLS host-environment report record `clusterStopped: true`, `tempDirectoryRemoved: true`, `clientsRemaining: 0`, and no cleanup errors. The six RLS shutdown child reports likewise match their recorded hashes and current source fingerprints, record complete cleanup, and require no rescue. This checks evidence continuity for the connection correction; it does not reopen the separate RLS scenario review.

The coordinating verification summary identifies both hostile environments as `PGSSLMODE=require PGPASSWORD=synthetic-ignored`. Those launch values and top-level process exit codes are recorded by the coordinating task, not independently observed executions by this reviewer. The individual runner reports do not themselves capture the launch environment. Their saved connection assertions, current driver fallback logic and matching source fingerprints support closure of this narrowly scoped P2 without rerunning completed tests.

## Reviewed source fingerprints

| File | SHA-256 |
| --- | --- |
| `experiments/t02-legacy-mapping/verify.cjs` | `29018f0fdc1276d65c5aebb7a5a10e8873bbe1b6d70f5d672d71f3dd731a5ae0` |
| `experiments/t02-legacy-mapping/README.md` | `9f20179a4ded8d6cb22bb9b29aa2df8d08ffdd9828080d4c036fc08ce7128500` |
| `experiments/rls-rehearsal/verify.mjs` | `2131ef7c1ac40669b1c12c5868c5f28eb5873a1e12634d9a6e514fd0964e4c70` |
| installed `pg/lib/connection-parameters.js` | `db77bac013bfb5faae661d3056f3fbc49f5bae60334f60b149de0c271a9d9725` |
| installed `pg/lib/client.js` | `7e6ba79fe6bc1db15ec66ce67cd0f96b6b27c300ccec45911dc15f5121f709f4` |

The pg files above are from `experiments/t05-durable-worker/node_modules/pg`. The four resolver/projector implementation and test fingerprints remain identical to the initial review; they were fingerprinted for continuity and were not substantively re-reviewed. All 12 source entries in the prior verification summary match current files. The summary itself was read at SHA-256 `e44ccbbc0b05742ed7ade2922eda433435c8158b5763fcdf131ac23fc69c9999`.

## Limits

This closes the SSL/password P2 on the source identified above. It is not an assertion that every possible `PG*` setting is isolated, nor a new execution of the saved tests. The exercised runtime remains local PostgreSQL 14.17 / pg 8.16.3; T02's signal evidence covers its stable fixture only. No production authorization, object existence/ownership, complete schema restore, PostgreSQL 17/Storage HTTP compatibility, backup/recovery, release readiness or plan milestone is established by this review. The separately pending metadata-collector review and other plan gates remain outside its scope.
