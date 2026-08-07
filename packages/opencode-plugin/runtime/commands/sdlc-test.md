---
description: Verify one approved Capability Unit by its user-readable name
---

Load the `sdlc-cu-testing` skill, then call `sdlc_status`.

The requested CU name is:

`$ARGUMENTS`

Require one exact CU name from the approved ExecutionPlan and an approved current CodeBaseline. Resolve the internal ID through project facts; never require the user to enter an ID. Do not silently repair product code or auto-run another lifecycle command.

End with one recommendation, one Todo and one complete `/sdlc-*` command; never execute it.
