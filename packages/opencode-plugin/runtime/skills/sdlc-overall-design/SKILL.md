---
name: sdlc-overall-design
description: Use when converting an approved RequirementBaseline into an overall software design, Capability Units and an ExecutionPlan.
compatibility: opencode
metadata:
  audience: software-engineering
  lifecycle: design
---

# SDLC Overall Design

## Hard gate

Call `sdlc_status` first. An immutable RequirementBaseline must exist and its Candidate Hash must match the requirements document used as input. A RequirementCandidate, assistant statement, Todo or user pressure is not a baseline.

If the gate is missing, do not draft any architecture, CU or Plan. Report the missing RequirementBaseline and recommend `/sdlc-review` for the current RequirementCandidate.

## Design contract

When the gate exists:

1. Read the approved requirements bytes and inspect the target scaffold facts. Preserve every unresolved requirement unknown; design must not silently decide it.
2. Maintain `docs/design/overall-design.md` with system boundary, runtime components, trust boundaries, data/credential flow, external interfaces, failure semantics and verification architecture.
3. Define Capability Units as independently reviewable vertical behavior slices, not technical layers or an arbitrary task list. A single mega-CU is invalid unless the document demonstrates that no smaller slice can be independently coded, reviewed and tested.
4. Every CU records:
   - stable internal `cuId` and unique user-readable `cuName`;
   - observable intent and in/out boundary;
   - dependencies by internal ID;
   - covered RequirementItem IDs;
   - product paths, test paths and verification obligations;
   - blocking unknowns and acceptance evidence.
5. Prove that every approved RequirementItem is covered by at least one CU or explicitly remains blocked. Do not omit dependency or verification coverage under user pressure.
6. Create a DesignCandidate with `sdlc_candidate_create` and stop for human review. Never claim approval.
7. Only after a DesignBaseline exists may `sdlc_plan_save` persist the CU order and dependencies. The Plan is project truth; OpenCode Todo is only a session projection and cannot alter or complete it.

## Guidance behavior

Offer one RecommendedAction, one Todo and one complete command. The Todo must be exactly `执行 <recommended command>` and must match the complete command byte-for-byte. Never auto-execute the recommendation. CU commands use `cuName`; internal IDs remain persisted references.

Before a DesignCandidate exists, recommend `/sdlc-design`. After it exists, recommend `/sdlc-review`. After DesignBaseline approval but before the Plan exists, recommend `/sdlc-design` to save the Plan.

## Common mistakes

- Designing from an unapproved RequirementCandidate.
- Splitting CU by Renderer, main process, API client or tests instead of observable behavior.
- Treating OpenCode Todo as ExecutionPlan.
- Hiding certificate, device or source gaps inside implementation assumptions.
- Saving a Plan before DesignBaseline approval.
