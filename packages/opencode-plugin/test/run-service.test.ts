import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectStore } from "../src/project-store.js";
import { InvalidRunOutcomeError, RunService } from "../src/run-service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("RunService", () => {
  it("cannot finish a run as succeeded after a captured failing command", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-run-"));
    temporaryDirectories.push(workspace);
    const service = new RunService(new ProjectStore(workspace), {
      id: () => "run-1",
      now: () => "2026-08-07T05:00:00.000Z",
    });
    const run = await service.start({
      command: "/sdlc-code 首页",
      sessionId: "session-1",
      cuId: "cu-home",
      gitBase: "abc123",
    });
    await service.recordToolResult(run.runId, { tool: "bash", exitCode: 1, outputHash: "b".repeat(64) });

    await expect(service.finish(run.runId, "SUCCEEDED")).rejects.toBeInstanceOf(InvalidRunOutcomeError);
  });

  it("recovers evidence from the journal before finishing a run", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-run-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    const first = new RunService(store, { id: () => "run-1", now: () => "2026-08-07T05:00:00.000Z" });
    await first.start({ command: "/sdlc-test 首页", sessionId: "session-1", cuId: "cu-home", gitBase: "abc123" });
    await first.recordToolResult("run-1", { tool: "bash", exitCode: 0, outputHash: "c".repeat(64) });

    const restarted = new RunService(store, { id: () => "unused", now: () => "2026-08-07T05:01:00.000Z" });
    await expect(restarted.finish("run-1", "SUCCEEDED")).resolves.toMatchObject({
      runId: "run-1",
      state: "SUCCEEDED",
    });
  });
});
