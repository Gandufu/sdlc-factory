---
description: Produce the overall design, Capability Units and approved-design execution plan
---

Load the `sdlc-overall-design` skill, then call `sdlc_status`.

Work only from an approved RequirementBaseline. Maintain the overall design and Capability Map, with user-readable CU names and stable internal CU IDs. Do not write product code or tests.

After creating a DesignCandidate, stop for human review. Only after a DesignBaseline exists may `sdlc_plan_save` create the ExecutionPlan. End with one recommendation, one Todo exactly matching `执行 <recommended command>`, and one complete `/sdlc-*` command; never execute it.
