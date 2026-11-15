# Design review

Reviewer: publication_design_review, independently dispatched read-only.

Recommendation: proceed with the unwired service-only finalization primitive,
strict RPC client, and published-pointer read compatibility. No tests were run
by this design reviewer. This is not final specification/quality approval.

- Promote private candidate pointer without another Storage write.
- Acquire deletion_requests SHARE before lease/row locks; READ COMMITTED only.
  Test reverse-order deadlock abort and table-wide contention limitations.
- Fail only branded permanent pre-candidate errors; reject candidates on any
  attempt and keep ambiguous outcomes unchanged.
- Preserve canonical seal conflicts; terminal status must be a separate reader.
- Include project/session tombstones in candidate asset access and export checks.
- Never finalize inside old verifier/supervisor callbacks; active checks follow.
- Physical deletion must capture authoritative pointer after tombstoning;
  existing route can hold a stale target, and no GC is currently implemented.
- Candidate GC must exclude referenced pointers even if candidate state remains
  prepared; Scheme-B candidate backup coverage is still required for deployment.
