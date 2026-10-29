# Operational snapshot evidence

Start with [verification.json](verification.json) for this batch's final status,
commands, counts, reviews and file hashes. [milestone-check.json](milestone-check.json)
separates the local engineering checkpoint from the original production gates.

## Passing evidence

- `full-verification-final.txt`: exact full workspace command-chain output,
  Web 131 suites / 1706 tests, shared 4 / 16, infra 7, build 184 pages, exit 0.
- `timestamp-green.txt`: final targeted adapter/evaluator/route run, 3 / 62.
- `pg-verification.json`: SQL agent's normal and host-environment-contaminated
  runs, both 15 scenarios / 251 assertions, plus earlier RED records.
- `pg-root-final.txt`: root's independent exact PG command replay, 15 / 251,
  with its full JSON report path. All recorded PID/socket/scratch cleanup checked.
- `spec-review.md` and `quality-review.md`: independent PASS verdicts and scope.

## Expected failures retained

`adapter-red.txt` records missing implementation and null metrics becoming healthy;
`route-red.txt` records missing integration/cache behavior; `timestamp-red.txt`
records acceptance of a non-contract date format. Their corresponding GREEN runs
pass. The PG index retains initial missing RPC and DST deadline failures, plus a
deliberate `--without-migration` run that must fail with `42883`. These are
regression evidence, not unresolved final failures. The SQL agent also observed
infra RED (6/7; the expected migration file did not yet exist), but did not save
a standalone log; `pg-infra.txt` is GREEN only.

Two additional intermediate failures were fixture parameter typing and runner
DateStyle parsing errors, not intentional product REDs. Their unchanged reports
and the fixes are classified in [pg-development-notes.md](pg-development-notes.md).

## Integrity and scope

- `source-hashes.json`: 10 implemented source/test/experiment inputs.
- `protected-inputs.json`: 1340 baseline inputs, including frozen historical
  migrations/experiments/evidence, dependencies and original next-env bytes.
- `raw/*.txt.gz`: exact original terminal logs. `log-hashes.json` records their
  compressed/uncompressed and display SHA-256. Readable `.txt` copies normalize
  only CR/LF, trailing line whitespace and final newline; raw bytes are retained.
- `verification.json` hashes all evidence files except itself, and current docs.

The exact four P1 CREATE TABLE blocks run with synthetic prerequisite tables;
this is not a full production migration-chain, PostgREST, provider, billing or
G0-G4 proof. Upload/export event coverage and real alert delivery remain absent.
The route always reports HTTP 503 / not_ready. No remote migration, deployment,
main merge, external family-data call or milestone push occurred.
