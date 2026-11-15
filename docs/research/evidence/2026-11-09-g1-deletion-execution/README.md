# G1 online media deletion evidence

- [Verification receipt](verification.json)
- [Final native SQL/actual HTTP worker/Chrome result](native-1794162300864-2c7e9820-df17-463e-b4f6-756313df1f3c/results.json) — 184 assertions, actual disk I/O with metadata/raw-byte separation.
- [Chrome screenshot](native-1794162300864-2c7e9820-df17-463e-b4f6-756313df1f3c/chrome-deletion.png)
- [Full migration and backup/restore result](../2026-11-07-g1-chrome/migrations-1794162170300-ae2193f2-0207-41c3-8c28-73f05212e305/results.json) — 31 files including bootstrap, 491 assertions, surviving original plays in Chrome.
- [Full Web verify log](final/verify.log), [shared log](final/shared.log), [infra log](final/infra.log).
- [Independent review](review.md)
- [Source manifest](source-manifest.json) and [source archive](source.tar.gz).

Earlier failed attempts remain in their unique directories. `native-red-*` records the absent execution RPC before implementation; initial fixture setup/compile errors are separately preserved. `infra-before-inventory-update.log` retains the missing migration inventory declaration failure. The extension runtime's initial missing `/tmp` installation is recorded under the existing migration runner's directory; the runtime was rebuilt, and the complete chain/restore passed.

No real family audio/accounts/providers or remote migration/deployment. The browser uses installed Chrome and a declared test operation page; actual production routes, SQL and worker execute behind it. Original captures/targets are immutable; reports distinguish API absence from provider-only orphan/backup erasure. Human tests are waived/deferred by the user's 2026-11-09 instruction, not represented as executed.
