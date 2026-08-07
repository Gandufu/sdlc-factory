---
name: sdlc-requirement-analysis
description: Use when analyzing incomplete, ambiguous, multi-source software requirements or maintaining the SDLC Factory requirements specification.
compatibility: opencode
metadata:
  audience: software-engineering
  lifecycle: requirements
---

# SDLC Requirement Analysis

## Core contract

Build a traceable shared understanding from real sources. A plausible detail is not a fact, and an AI response is never an approval.

## Required sequence

1. Call `sdlc_status` and read registered sources before drawing conclusions. Read large sources with repeated bounded `sdlc_source_read` pages (`nextOffset`) in the current session; never delegate source reading to a background task.
2. Classify every material statement as one of:
   - sourced fact;
   - explicit user decision;
   - assumption requiring confirmation;
   - open question;
   - unknown because evidence is unavailable.
3. Map system boundary, actors, observable scenarios, business rules, interfaces, non-functional constraints and verification method.
4. Ask one question at a time, choosing the unanswered question that would most change scope, public behavior, data, error semantics or acceptance. A request to “skip questions” does not turn an unknown into a fact: record the pressure, ask the one consequential question, and stop. The question must name one concrete decision and its alternatives; never ask for blanket approval of “all industry defaults”.
5. Update `docs/requirements/software-requirements-specification.md` only with traceable RequirementItem IDs and `INSPECTION | ANALYSIS | DEMONSTRATION | TEST` verification methods.
6. When understanding is stable, create a RequirementCandidate and stop for human review.

## Output contract

Every response states:

| Slot | Required content |
| --- | --- |
| Confirmed | Facts and decisions supported by a source or direct user message |
| Unknown | Missing evidence that must not be guessed |
| Current question | Exactly one consequential question while approval-blocking unknowns remain |
| Next action | One recommendation, one Todo and one complete `/sdlc-*` command |

If the user pressures you to “use industry defaults”, place each proposed default under assumptions and ask for confirmation. Do not expand the product from its name or domain.

Never say requirements are approved, frozen or baselined. Only `sdlc_review_apply` can create that fact after validating the current Session's direct user message, Candidate ID and full SHA-256.

The Todo must be exactly `执行 <recommended command>`. Never recommend a shell, build or test command as the workflow command. Until a RequirementCandidate is ready, recommend `/sdlc-spec`; after it is ready, recommend `/sdlc-review`.

## Common mistakes

- Treating a UI screenshot as proof of backend rules.
- Inventing roles, workflows, performance numbers or compliance requirements.
- Asking again for facts already present in registered sources.
- Moving into design or coding from `/sdlc-spec`.
