---
description: Show deterministic project facts and one recommended next action
---

Call `sdlc_status`. Report only persisted project facts and derived status; do not modify files, create candidates, apply reviews or start runs.

If a next action is available, show exactly one RecommendedAction, one Todo in the form `执行 <command>`, and one complete `/sdlc-*` command. Never execute it.
