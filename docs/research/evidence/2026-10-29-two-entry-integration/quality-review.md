# Independent quality review

Reviewer: `hub_quality_review`, a separate read-only agent. Root transcribed the
review result. Final verdict: **Approved for this local integration batch**;
no remaining actionable findings in the re-reviewed changes.

Initial findings and verified fixes:

- P1: Index rows in the real P3 schema have no `media_asset_id` or `story_title`.
  Search now resolves P2 `transcript_versions.asset_id` and actual stories titles,
  requires consistent project/story links and suppresses unavailable/deleted
  source evidence. Real-schema-shaped tests replace fabricated index fields.
- P1: Removing source audio left transcript/summary in HTML/PDF. Export now reads
  bounded transcript lineage and fails the whole ZIP when audio sources are
  removed/unresolved. Legacy story-linked audio is screened too. Removing an
  unrelated image does not suppress independently sourced story text. Final
  authorization/deletion rechecks remain after compression.
- P2: Optional `expectedBytes` was compared to subsequently measured `byte_size`.
  An omitted expectation can now replay after measurement; explicitly supplied
  mismatches and actor/project/metadata conflicts remain rejected.

Independent re-review executed the affected four suites: **114 tests passed**.
Other verification is recorded separately in `verification.json`; review approval
does not certify actual Next/Auth/Storage HTTP, physical devices, or G1/G3/G4.

Conservative behavior must remain explicit: unresolved legacy citations are not
displayed, and project-only imported originals need verified story association
before search. No migrations, Workers or production release were approved.
