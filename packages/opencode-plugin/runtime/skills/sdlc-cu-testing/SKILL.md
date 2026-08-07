---
name: sdlc-cu-testing
description: Use when independently verifying one approved Capability Unit and producing test or system-acceptance evidence.
compatibility: opencode
metadata:
  audience: software-engineering
  lifecycle: testing
---

# SDLC CU Testing

## Hard gate

Call `sdlc_status` first. Require an approved RequirementBaseline, DesignBaseline, matching ExecutionPlan, one exact Plan `cuName`, and that CU's current approved CodeBaseline. A CodeCandidate, passing statement or changed file is not a CodeBaseline.

Resolve missing gates in lifecycle order and stop without testing. A pending RequirementCandidate or CodeCandidate requires `/sdlc-review`; missing design/Plan requires `/sdlc-design`; missing code requires `/sdlc-code <CU名称>`.

## Independent verification contract

1. Re-read persisted baselines, CU verification obligations and current files. Do not trust Coding Skill summaries or its claimed test results.
2. Capture the real Git base and start `/sdlc-test <CU名称>` with `sdlc_run_start` before test changes or commands.
3. Test changes are limited to the CU's declared test paths. If correct verification requires a product-code change, record the finding, finish `BLOCKED` or `FAILED`, and recommend `/sdlc-code <CU名称>`; never silently repair product code inside a passing TestCandidate.
4. Run exact focused and regression commands with repository-pinned `corepack pnpm@10.34.5`. Record exit codes and output hashes with `sdlc_run_record_result`. Never infer an unexecuted command passed.
5. Keep mock HTTPS evidence separate from real-device evidence. `localhost`, loopback, fixtures and mock servers can prove automated behavior only; they never prove a real-device acceptance.
6. Real-device validation may use only the presence and runtime consumption of `SDLC_TEST_DEVICE_IP` and `SDLC_TEST_DEVICE_PASSWORD`. Never print, persist, echo, screenshot or read the password into the conversation. If either variable is absent, connection fails, or no controlled certificate-trust method exists, record `未验证` and do not create a SystemAcceptanceBaseline.
7. A TestCandidate requires an honestly successful Run and exact test/evidence paths. A SystemAcceptanceCandidate additionally requires successful non-loopback HTTPS evidence and explicit certificate trust. Neither Candidate is approved by the assistant.
8. Stop after creating the applicable Candidate. Never apply review, auto-enter system acceptance or choose another CU.

## Result semantics

- `PASSED`: actual required commands exited successfully and all CU obligations have current evidence.
- `FAILED`: an assertion or command failed.
- `BLOCKED`: required input, environment, trust or safe verification capability is missing.
- `SKIPPED`: an explicitly non-required check was not run; it cannot satisfy an obligation.

Do not turn `FAILED`, `BLOCKED`, `SKIPPED` or “not run” into `PASSED`.

## Guidance behavior

Offer one RecommendedAction, one Todo as plain text exactly `执行 <recommended command>`, and one matching complete command. No backticks or trailing punctuation inside the Todo value. After a TestCandidate, recommend `/sdlc-review <CU名称>`. For a product defect, recommend `/sdlc-code <CU名称>`.

Plan controls CU order and required evidence. Todo is a non-authoritative Session hint and cannot prove completion.

## Common mistakes

- Testing a CodeCandidate before human approval.
- Using localhost as real-device evidence.
- Logging environment values for diagnostics.
- Repairing product code and keeping the same test conclusion.
- Treating automated pass as TestBaseline or SystemAcceptanceBaseline.
