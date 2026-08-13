import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CommandAttemptLimitError, ControlledExecutionService } from "../src/controlled-execution.js";
import { ProjectStore } from "../src/project-store.js";
import { writeManifest } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ControlledExecutionService", () => {
  it("直接等待进程退出并自动保存脱敏命令证据", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-execution-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    await store.writeImmutable("runs", "run-1", {
      runId: "run-1",
      command: "/sdlc-test 系统管理",
      commandType: "MODULE_TEST",
      sessionId: "session-1",
      scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
      gitBase: "abc123",
      inputVersionIds: ["code-module-system-management-r1"],
      allowedProductPaths: [],
      allowedTestPaths: ["test/system-management"],
      createdAt: "2026-08-11T05:00:00.000Z",
    });
    const result = await new ControlledExecutionService(store, workspace, {
      id: () => "evidence-1",
      now: () => "2026-08-11T05:00:01.000Z",
    }).execute({
      runId: "run-1",
      executable: "node",
      arguments: ["-e", "console.log('token=secret-value')"],
      workingDirectory: ".",
      timeoutMs: 10_000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdoutTail).toContain("token=[REDACTED]");
    await expect(readFile(path.join(workspace, result.stdoutPath), "utf8"))
      .resolves.not.toContain("secret-value");
  });

  it("同一运行中的同一命令最多允许一次重试", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-execution-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    await store.writeImmutable("runs", "run-1", {
      runId: "run-1",
      command: "/sdlc-test 系统管理",
      commandType: "MODULE_TEST",
      sessionId: "session-1",
      scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
      gitBase: "abc123",
      inputVersionIds: ["code-module-system-management-r1"],
      allowedProductPaths: [],
      allowedTestPaths: [],
      createdAt: "2026-08-11T05:00:00.000Z",
    });
    let sequence = 0;
    const execution = new ControlledExecutionService(store, workspace, {
      id: () => `evidence-${++sequence}`,
      now: () => `2026-08-11T05:00:0${sequence}.000Z`,
    });
    const input = {
      runId: "run-1",
      executable: "node",
      arguments: ["--version"],
      workingDirectory: ".",
      timeoutMs: 10_000,
    };

    await expect(execution.execute(input)).resolves.toMatchObject({ exitCode: 0 });
    await expect(execution.execute(input)).resolves.toMatchObject({ exitCode: 0 });
    await expect(execution.execute(input)).rejects.toBeInstanceOf(CommandAttemptLimitError);
  });
});
