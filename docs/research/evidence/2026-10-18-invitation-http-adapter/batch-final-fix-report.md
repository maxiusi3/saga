# Single final documentation fix wave — M1

Status: DONE for the requested wording fix; frozen at 2026-10-18 22:26:46 Asia/Taipei. Scoped independent re-review remains controller-owned. Earlier reports and review/status evidence were not edited.

## Exact scope

Read task-2-review.md, which records Minor M1: the total of 194 belongs to three focused suites, while actual SDK/synthetic loopback coverage belongs to the handler suite. The two summary clauses now state that distinction. They do not label every handler case as a network round trip. No implementation, test, status, count, approval or production-boundary claim changed.

Only docs/2026-10-10-integrated-upgrade-plan.md line 46 and docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md line 29 were edited, plus this newly created private report. No earlier report, manifest, review, source or other document was written. No tests, project verification, subagents, commit, push, remote call, migration or deployment.

## Before/after hashes and byte comparison

Comparison basis: the controller's preserved before-final-fix/ tree. Before editing, both current files were byte-identical to their preserved copies. Each old clause appeared exactly once. Each file was changed with a single byte-string replacement; replacing the new clause with the old clause after writing restored the complete baseline bytes exactly. No newline normalization or full-file text reformatting was used.

### docs/2026-10-10-integrated-upgrade-plan.md

- Before SHA-256: `83439530eea1284a663d016ab59976e9bb90681f6e2297725813cbd051a2cb94`
- After SHA-256: `89860dae63fc771f5d949701d86202dc61ddfce03230c504d7ad7c367ab7e66e`
- Replacement byte offset: 19480 (zero-based).
- Unchanged prefix SHA-256: `e709f55a029771aa1e03478b411699124becab4d7df9c74a1c3732691c730bd4`
- Unchanged suffix SHA-256: `94900fc6a8b2c97ccffc085adf34066bc0fd94d3fc99fdcf4769ae571b34401c`
- Reverse replacement reproduces the complete before bytes: true.

Before clause:

```text
实际SDK对合成loopback的定向194项通过；
```

After clause:

```text
定向三套共 194 项通过；handler 测试使用实际 SDK 对接合成 loopback；
```

### docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md

- Before SHA-256: `520bb6812fd0f634028acaf297bbabfa1fa223682a9f420fb551f538e424afb6`
- After SHA-256: `20d16f182c2893f2d5cee7b01161bc697524fb76863e4060c749aad09596146c`
- Replacement byte offset: 6044 (zero-based).
- Unchanged prefix SHA-256: `3b322954d47f0970c7aacf6fca03724d5e87c0691ef2f07c903f5460391c32e8`
- Unchanged suffix SHA-256: `5b5a37708e1ee09e5b83a87a3a3a8c56ef67fa8efd1ab1d21bd35dd25a0d8130`
- Reverse replacement reproduces the complete before bytes: true.

Before clause:

```text
实际SDK对合成Auth/REST loopback的194项、
```

After clause:

```text
定向三套共 194 项通过；handler 测试使用实际 SDK 对接合成 loopback；
```

## Preserved snapshot check

Compared all 21 files in before-final-fix/ to the current corresponding files. Exactly the two paths above differed; the other 19 were byte-identical. For each changed path, the complete after bytes equal the complete before bytes with only its one declared clause replaced. This scoped byte comparison is the verification for the wording-only change; no behavioral tests were needed or run. The new private report is outside that preserved snapshot.
