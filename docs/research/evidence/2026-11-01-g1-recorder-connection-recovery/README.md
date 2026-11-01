# G1 Recorder Connection Recovery Evidence

Baseline `f59e8f863`. Local connection lifecycle contract only; G1 and push conditions remain false.

- `takeover-check.json`: initially clean branch, 1471 historical inputs checked, 60 prior G1 evidence files protected.
- `prior-evidence-hashes.json`: original bytes of both preceding G1 evidence directories, including locally present ignored logs.
- `connection-red.json`: five new behavioral subcase failures; original 23 cases pass, exit 1. Node counts the failing parent as a sixth failure.
- `connection-green.json`: same test source; 28 subcases / 29 Node tests pass, exit 0, no skips.
- `focused-jest.json`: four existing recorder/recovery suites, 68 tests pass, exit 0.

Each execution receipt records command, source hashes before/after, exit code and raw byte length/SHA256. The archive path points to `raw/*.log.gz`; decompress it to verify the raw hash. Ignored `.log` files do not need to be present in a fresh checkout.

`full-chain.json`: actual exit 0, Web 139 suites / 2196 tests, shared 4/16, infra 14 and 184 generated pages. `next-env-check.json` records the known generated import and exact original-byte restoration.

## Final Sealing

- `spec-review.md` / `quality-review.md`: actual independent PASS then Approved. Each reviewer independently reran browser 28 subcases / Node 29 and Jest 4/68, exit 0. These are review receipts, not primary raw command logs.
- `verification.json`: validated local results; `milestone-check.json`: G1 and push conditions remain false.
- `source-hashes.json` / `log-hashes.json`: 11 final source inputs and four raw/compressed execution logs.
- `protected-inputs-check.json`: final recheck of 1471 historical inputs and 60 prior G1 evidence files, zero mismatches.
- `document-hashes.json`: final report/plan/current handoff/index and receipts; excludes itself and final-integrity to avoid circularity.
- `final-integrity.json`: pre-commit source, document, log, historical and staged-byte verification. Sealed with the local checkpoint; actual commit identity and post-commit cleanliness are checked separately using Git.

Only loopback and synthetic bytes are used. Version-error and upgrade-abort cases use real native requests; abnormal close is simulated by closing a native handle and dispatching the close notification. This is not a real browser termination, multi-tab product qualification, physical quota test or playable long-audio/device acceptance.
