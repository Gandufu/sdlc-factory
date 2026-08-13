import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CommandEvidence } from "../src/domain.js";
import { ProjectStore } from "../src/project-store.js";
import { CodingTodoRequiredError, InvalidRunOutcomeError, RunService } from "../src/run-service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function service(store: ProjectStore) {
  return new RunService(store, { id: () => "run-1", now: () => "2026-08-11T05:00:00.000Z" });
}

async function startCoding(store: ProjectStore) {
  return service(store).start({
    command: "/sdlc-code 系统管理",
    commandType: "CODE",
    sessionId: "session-1",
    scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
    gitBase: "abc123",
    inputVersionIds: ["design-set-project-r1"],
    allowedProductPaths: ["src/system-management"],
    allowedTestPaths: ["test/system-management"],
  });
}

async function writeEvidence(
  store: ProjectStore,
  exitCode: number,
  evidenceId = "evidence-1",
  startedAt = "2026-08-11T05:00:00.000Z",
): Promise<void> {
  const evidence: CommandEvidence = {
    evidenceId,
    runId: "run-1",
    executable: "node",
    arguments: ["--version"],
    workingDirectory: ".",
    exitCode,
    timedOut: false,
    startedAt,
    finishedAt: "2026-08-11T05:00:01.000Z",
    durationMs: 1000,
    stdoutPath: "evidence/run-1/out.log",
    stdoutHash: "a".repeat(64),
    stderrPath: "evidence/run-1/err.log",
    stderrHash: "b".repeat(64),
  };
  await store.writeImmutable("command-evidence", evidence.evidenceId, evidence);
}

describe("RunService", () => {
  it("编码运行在 todowrite 形成清单前阻止文件修改和命令", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-run-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await startCoding(store);

    await expect(service(store).assertToolAllowed("session-1", "edit"))
      .rejects.toBeInstanceOf(CodingTodoRequiredError);
  });

  it("不同会话不能同时启动同一业务范围的运行", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-run-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await startCoding(store);

    await expect(service(store).start({
      command: "/sdlc-test 系统管理",
      commandType: "MODULE_TEST",
      sessionId: "session-2",
      scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
      gitBase: "abc123",
      inputVersionIds: ["code-module-system-management-r1"],
      allowedProductPaths: [],
      allowedTestPaths: [],
    })).rejects.toThrow("当前范围已有未结束运行");
  });

  it("失败命令证据不能被运行结论隐藏", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-run-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await startCoding(store);
    await writeEvidence(store, 1);

    await expect(service(store).finish("run-1", "SUCCEEDED"))
      .rejects.toBeInstanceOf(InvalidRunOutcomeError);
  });

  it("同一命令修复后原样重试成功可以收口且保留历史失败证据", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-run-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await startCoding(store);
    await service(store).recordTodoInvocation("session-1");
    await service(store).captureTodo("session-1", Array.from({ length: 5 }, (_, index) => ({
      id: `todo-${index}`,
      content: `步骤 ${index}`,
      status: "completed",
      priority: "high",
    })));
    await writeEvidence(store, 1, "evidence-failed", "2026-08-11T05:00:00.000Z");
    await writeEvidence(store, 0, "evidence-passed", "2026-08-11T05:01:00.000Z");

    await expect(service(store).finish("run-1", "SUCCEEDED")).resolves.toMatchObject({ state: "SUCCEEDED" });
    await expect(store.listJson<CommandEvidence>("command-evidence")).resolves.toHaveLength(2);
  });

  it("成功编码要求真实命令证据和至少五项全部完成的待办", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-run-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await startCoding(store);
    await service(store).recordTodoInvocation("session-1");
    await service(store).captureTodo("session-1", Array.from({ length: 5 }, (_, index) => ({
      id: `todo-${index}`,
      content: `步骤 ${index}`,
      status: "completed",
      priority: "high",
    })));
    await writeEvidence(store, 0);

    await expect(service(store).finish("run-1", "SUCCEEDED")).resolves.toMatchObject({
      runId: "run-1",
      state: "SUCCEEDED",
    });
  });
});
