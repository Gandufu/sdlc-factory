---
name: sdlc-cu-coding
description: Use when implementing exactly one approved Capability Unit from the persisted ExecutionPlan.
compatibility: opencode
metadata:
  audience: software-engineering
  lifecycle: coding
---

# SDLC CU Coding

## Hard gate

Call `sdlc_status` first. Require an approved DesignBaseline, an ExecutionPlan bound to its exact Hash, and one command argument that exactly matches a Plan `cuName`.

Reject internal `cuId`, partial matches, guessed names and arbitrary file requests. Resolve the internal ID only after the name matches. Require every dependency's current approved CodeBaseline and TestBaseline before starting, unless the Plan explicitly marks the dependency as non-blocking.

If any gate is missing, do not modify files or simulate completion. Recommend the command that resolves the first missing fact.

Resolve missing gates in this order:

1. RequirementCandidate without RequirementBaseline → `/sdlc-review`.
2. RequirementBaseline without DesignBaseline or ExecutionPlan → `/sdlc-design`.
3. Candidate awaiting review → `/sdlc-review <CU名称>`.
4. Missing dependency baseline → the exact `/sdlc-code <dependency CU名称>` or `/sdlc-test <dependency CU名称>` selected by Plan facts.

## Execution contract

1. Re-read the approved RequirementBaseline, DesignBaseline, CU contract and current files. Do not trust a prior assistant summary.
2. Capture the real Git base, then call `sdlc_run_start` with the complete `/sdlc-code <CU名称>` command, exact CU name and Git base before product changes.
3. Work only within this CU's declared product and developer-test paths. Never read or persist `SDLC_TEST_DEVICE_PASSWORD`; credentials and tokens must not enter code, logs, Evidence, screenshots or Git.
4. Use test-first implementation for observable CU behavior: demonstrate a relevant failing test, implement the smallest change, then rerun focused verification. Use only the repository-pinned `corepack pnpm@10.34.5` commands.
5. Record actual command results with `sdlc_run_record_result`. A failure remains failure evidence; do not describe it as success.
6. Inspect the resulting diff against CU boundaries and approved RequirementItem coverage. Unrelated changes stop the run as `BLOCKED`.
7. Finish the Run with its honest terminal state. Only a successful Run may create an immutable CodeCandidate from exact changed paths.
8. Stop after the CodeCandidate. Never approve it, auto-run tests, select the next CU or execute a recommendation.

## Guidance behavior

Offer one RecommendedAction, one Todo exactly `执行 <recommended command>`, and one matching complete command. Render the Todo as plain text with no backticks, quotes, bullet prefix inside the value or trailing punctuation. Before a successful candidate, recommend `/sdlc-code <CU名称>`; after it, recommend `/sdlc-review <CU名称>`.

Plan and Todo are separate: the Plan controls CU order, inputs and dependencies; Todo is only the visible suggestion for this Session and proves nothing.

## Common mistakes

- Accepting `cuId` because it looks unambiguous.
- Coding from a DesignCandidate or stale Plan.
- Editing several CUs for convenience.
- Claiming completion without exact Git, command and exit evidence.
- Treating a passing focused test as human approval or a TestBaseline.
