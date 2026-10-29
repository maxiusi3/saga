# PG runner development failures

These two preserved reports are runner/fixture development errors, not intentional
product REDs. The root agent records the SQL implementer's diagnosis; raw error
messages were not saved and no reconstructed exception text is claimed as evidence.

- `pg-verify-2026-10-29T05-03-01.584Z-00d41e21-aa45-4edb-a8cc-d40b39dde947.json`:
  SQLSTATE `42P08` during the first job fixture. One `$1` parameter was used as both
  UUID and text. The fixture now casts `$1::uuid` and `($1::uuid)::text` explicitly,
  with typed double-precision time offsets. Classification: fixture parameter typing.
- `pg-verify-2026-10-29T05-05-15.796Z-0619f31c-9896-402a-8002-18fc2c9f159a.json`:
  `UNEXPECTED_FAILURE` in the DateStyle/MVCC scenario. The runner assumed the driver
  always returned a valid Date after `SET DateStyle = 'SQL, DMY'`. It now compares
  database epoch milliseconds returned as text against the RPC's UTC ISO timestamp.
  Classification: runner DateStyle parsing assumption.

Neither correction changed the aggregation SQL. Final normal, contaminated and
root replay use the fixed runner, each passing 15 scenarios / 251 assertions.
Original JSON failures and their successful cleanup are retained unchanged.
