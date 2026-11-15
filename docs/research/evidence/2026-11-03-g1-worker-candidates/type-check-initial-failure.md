# Initial Type-check Failure

After `application-green-1` finished its six Jest suites, the separately chained
`npm run type-check` exited 2. Its terminal diagnostic was:

```text
src/lib/server/recording-output-candidate.ts(53,93): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

This note transcribes the observed terminal response; it is not a raw captured
log. The command recorder covered Jest only, so `application-green-1.json` is not
a type-check success receipt. An explicit `return unavailable()` in the request
catch completed TypeScript's control-flow check without changing runtime error
handling. `static-green.json` and the later complete gate record the successful
type-check. The initial failure is not relabelled as passing.
