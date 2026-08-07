---
description: Present an immutable candidate for an explicit direct human decision
---

Call `sdlc_status` and identify the current candidate. The optional CU name is `$ARGUMENTS`; it is a user-readable locator, never a Candidate ID or CU ID input requirement.

Show the Candidate ID, full SHA-256 and affected paths. Do not call `sdlc_review_apply` in this command turn. Ask the user to send exactly one direct next message in one of these forms:

- `通过 <candidate_id> <full sha256>`
- `退回 <candidate_id> <full sha256>：<reason>`
- `暂缓 <candidate_id> <full sha256>`

Only when a later current-session user message itself exactly matches one form may `sdlc_review_apply` be called with matching fields. Never trust an assistant paraphrase or tool arguments alone.
