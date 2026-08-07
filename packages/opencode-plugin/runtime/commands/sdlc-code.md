---
description: Implement one approved Capability Unit by its user-readable name
---

Load the `sdlc-cu-coding` skill, then call `sdlc_status`.

The requested CU name is:

`$ARGUMENTS`

Require one exact CU name from the approved ExecutionPlan. Resolve its internal ID through project facts; never require the user to enter an ID. Work only on that CU and do not auto-run `/sdlc-test`, `/sdlc-review` or the next CU.

End with one recommendation, one Todo and one complete `/sdlc-*` command; never execute it.
