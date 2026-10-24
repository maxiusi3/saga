# T01 prototype specification review

2026-10-13. Read-only review against `docs/superpowers/specs/2026-10-13-upgrade-t01-prototype.md`.

**Result: PASS after the two findings below were corrected and rechecked. No remaining required specification fixes were found.**

Reviewed artifact: `docs/prototypes/2026-10-13-two-entry/index.html`.
Final reviewed SHA256: `d0cb7bee1b44afaff593a8561fd8e4fc64041b8a8dd373fe4638294050322b39`.

## Resolved findings

1. **[P2, resolved] Include name editing in the free-action area — index.html:84.** The original registry omitted `NAME_EDIT`, preventing a free-play edit attempt after approval. The registry now includes every reducer action. A narrow reducer check confirmed name editing succeeds on a ready draft, while an edit after approval is refused and the approved snapshot stays unchanged. The UI handler reads the existing draft-name input when it is available.

2. **[P2, resolved] Do not claim a missing original remains confirmed — index.html:66.** The original `PROCESS → MISSING → AI_FAIL` feedback incorrectly said the cloud original remained confirmed. The message now checks cloud status. A narrow replay confirmed this sequence preserves `cloud: 'missing'` and `local: 'ready'` and reports that the original needs restoration and confirmation. The ordinary confirmed-cloud failure message remains accurate.

## Passing checks

- One standalone HTML file; fictional Alex/Sam example and exact first-home question; visible simulation/reset disclosures; no external dependencies, network APIs, microphone APIs, real-file input or persistent storage in the implementation. CSP denies network and media access.
- The pure reducer rejects illegal actions with the original state; entry switches and reset clear content, consent, approval and export state. Authentication preserves the question ID and text.
- Source permission gates recording/local import; text preparation has separate consent and requires a confirmed original. Independent/accompanied invitation modes are represented.
- Device and cloud states are distinct. Upload failures preserve the device copy. Recovery requires saved partial segments and simulated reopening; a no-segment recovery is refused.
- AI failure changes only AI state. Retrying does not create multiple originals or stories. Serious unresolved name/year decisions block approval; skipping leaves them unresolved.
- Both conflict resolutions produce an uncertain narrative, retaining Alex’s 1990 memory and Sam’s attributed 1989 addition. Source excerpts include fictional time marks and explicitly disclose no audio playback.
- Approval stores a cloned snapshot. AI rerun and edits are refused while approved; withdrawal enables editing. Missing/unconfirmed originals block receipt download.
- Successful download creates a explicitly marked PROTOTYPE JSON receipt without media. The main approved view states this beside the download action.
- Six sequential guided scenarios reset when selected. Ad hoc execution of all 85 reducer steps matched their expected acceptance/refusal outcomes; rejected steps retained state. This was an in-memory inspection, with no test files or long-lived suite added.
- User-entered name text is escaped in visible text and input attributes before HTML rendering. JSON serialization does not interpret it as markup.
- Final JavaScript parses successfully. Follow-up source inspection confirms the added free-play feedback uses `textContent`, the scenario tabs support arrow/Home/End navigation and reset through their existing click handler, and the empty device state now explicitly says no data is saved.

## Review limits

The parent controller is performing browser interaction, viewport, focus, network and download checks. This review does not claim those checks or household research were completed. Production recording, storage, AI, deployment and complete media export are explicitly outside this disposable prototype’s scope.
