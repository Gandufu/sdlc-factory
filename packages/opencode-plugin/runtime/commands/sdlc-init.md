---
description: Initialize deterministic SDLC Factory state for the current project
---

Call `sdlc_status` first. If the project is already initialized, report its current facts and do not initialize again.

If initialization inputs are missing, ask for the project name and explicitly authorized external read roots. Otherwise call `sdlc_init` once. Do not infer read roots or execute another lifecycle command.

End with one recommended action, one Todo and one complete `/sdlc-*` command. Never execute the recommendation.
