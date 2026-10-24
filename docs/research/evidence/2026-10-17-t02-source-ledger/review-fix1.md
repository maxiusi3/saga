# T02 source ledger — independent R1 follow-up

Date: 2026-10-17 (Asia/Taipei)

**Verdict: scoped PASS. R1 / P2 from [review-initial.md](review-initial.md) is closed. No new actionable specification or code-quality finding was identified in the correction.**

## Scope and method

This follow-up covers only R1's missing history after source removal and the changes introduced to resolve it. The reviewer read the Fix 1 implementation report, `task-2-fix1-review.diff`, the current correction and focused scenarios. Each saved pre-fix file matches the initial reviewed fingerprint; the supplied diff contains the complete actual changes in README, adapter, scenarios and runner. The schema and existing resolver/projector remain unchanged. The review diff SHA-256 is `a71a3f91c2caf8cfdfb3852aec979f4e2b8496676ea76be5e43a9b249124877b`.

The reviewer independently recomputed source, report, RED snapshot and metadata snapshot hashes. No test suite or new reproduction was run during this follow-up. No remote access, credential read, implementation change, subagent, commit or push was involved. Only this follow-up report was written; the initial finding remains preserved as historical evidence.

## R1 closure

`experiments/t02-source-ledger/ledger.cjs:76–89` now reads the distinct previously observed field/path identities for the already locked project/story and compares them with the actual current projector output. Each absent historical path is included as an explicit removal observation with JSON null raw value, `locator_status='unresolved'`, `reason='source reference removed'`, and no bucket/key. Never-observed empty fields invent no path.

Those removal entries flow through the existing full-field/type/version digest and append-only insertion path at lines 92–108. Consequently, the current null/empty/shortened field is persisted even when it produces no current media reference. The same project/story locks protect the historical-path read and the current field snapshot through COMMIT; the fix does not introduce another lock order or accept a caller-supplied source identity.

The unchanged unique key returns the existing removal ID when the same version is collected again, and `conflicts_with` links a newly observed version to an earlier different version of that path. Inserting a removal does not update the old observation, review or binding. Restoration of an earlier complete field returns its original mapped identity while preserving removal history. The unchanged binding guard at line 129 rejects the new unresolved records; the full-field comparison rejects an old mapped observation while its source is removed.

The focused real PostgreSQL scenarios at `scenarios.cjs:155–214` cover:

| Transition | Specific coverage |
| --- | --- |
| Scalar `photo_url` to SQL NULL | Previously missing scalar version is stored at its original path |
| `photo_urls text[]` to empty / SQL NULL | Both absence forms persist typed whole-field snapshots |
| `images jsonb[]` to empty / SQL NULL | Both absence forms retain the prior nested URL path |
| Shorten `photo_urls` | Removed position gets a successor; surviving position remains separately mapped |
| Remove an image thumbnail property | Removed property gets a successor; surviving original URL remains mapped |

Each of the seven cases first commits a real binding and review, then checks the explicit removal payload/type/digest/link, reads the persisted successor, repeats collection without additional rows, verifies original observation/review/binding equality, rejects binding both the removal and stale original, verifies no inherited binding and restores the earlier mapped ID. The two partial-removal cases separately check surviving mapped references. This directly addresses the independent reproduction in the initial review.

The runner change only extends RED-snapshot label matching to include `fix1-red-`; it does not change fixture initialization, connection options or cleanup. The README accurately describes retained historical paths and non-bindable removal records. No additional actionable quality concern was found in these changes.

## Evidence checked

The genuine [R1 RED report](fix1-red-r1-1792217681643-58863.json) records failure after 77 successful checks at “scalar to null: previously observed path has a durable removed successor” (`false !== true`). All five saved RED source snapshots match that report. Its SHA-256 is `f9bc237c8632ce4e9afdc4d0fd1883c8eeaef8e184938bca2340f9265e2e8e5d`.

All final reports contain the same seven current experiment/resolver/projector source fingerprints and the correct pinned metadata snapshot hash. The two completed runs each record 290 successful checks, including exactly 100 R1 checks, 18 lock records, and final counts of 82 observations, 8 reviews, 13 bindings and 39 synthetic assets.

| Final report | Recorded result | Independently recomputed SHA-256 |
| --- | --- | --- |
| [fix1-normal-final-1792217755916-59095.json](fix1-normal-final-1792217755916-59095.json) | passed; 290 checks | `6743e26ea850bb192016bf36c12256ee82c2b64b811e7a44dff7e795a34feb26` |
| [fix1-host-env-final-1792217781277-59229.json](fix1-host-env-final-1792217781277-59229.json) | passed; 290 checks | `6f18866ba0b23f4cf6a88c5457c9567675c49511b479ba9d7e4701af2406de46` |
| [fix1-signal-final-1792217781277-59230.json](fix1-signal-final-1792217781277-59230.json) | stable-fixture SIGTERM; interrupted after 21 checks | `c43fec3e4bfa68129f38ef03dd1dd702180f2a38cd8b13c19467b34d00b3130d` |

All three final reports and the R1 RED report record a stopped cluster, removed temporary directory, zero clients and no cleanup errors. Normal/host exit 0, signal exit 143 and the synthetic host launch settings are supplied by the implementation report; they are not newly observed executions by this reviewer. The signal run is cleanup evidence rather than a pass of the R1 scenarios.

## Reviewed fingerprints

| File | SHA-256 |
| --- | --- |
| `experiments/t02-source-ledger/README.md` | `20850528dbdfb08d85d1d6029761324d1005b15e638b6a940454721ff25740d2` |
| `experiments/t02-source-ledger/ledger.cjs` | `a9d5ea5b52252897a4952bd2e48e24ab33f814490e42db74b3c040de11d7a63e` |
| `experiments/t02-source-ledger/scenarios.cjs` | `0558af3fd7421b0808f2dc1e49c2e51ddf1923ee94e9a15d48d76e5fe1eb6518` |
| `experiments/t02-source-ledger/schema.sql` (unchanged) | `1ee41a18d58a45b07ffef264534f8dca94d02757a0381883606b49b2c67323a4` |
| `experiments/t02-source-ledger/verify.cjs` | `2812de7790a5fad62bfac32e1ef85ff2121b4b0200a5b02af547a57e7d113749` |

The fixed resolver and projector retain hashes `896631ce8e2e32ad2968663d3d97e9701bd3df41367041ab838b6a2acd1af30c` and `1fe15dd0e88a62a04b75eab107658ea777c58598639816a6f62646627243158e`, respectively.

## Limits

This closes the initial review's sole actionable finding on the identified source. It does not reopen unrelated initial-review code or the historical worktree, claim exhaustive combinations of source removals, or add production acceptance. The prior limits for trusted actor/owner connection, actual Storage verification, complete authorization/consent/RLS/triggers, PG17, backup/recovery, other interruption phases and G0/G1 milestones remain in force.
