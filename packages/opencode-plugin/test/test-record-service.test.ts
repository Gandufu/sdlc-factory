import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ControlledExecutionService } from "../src/controlled-execution.js";
import { ProjectStore } from "../src/project-store.js";
import { RunService } from "../src/run-service.js";
import { TestRecordService, VerificationReportService } from "../src/test-record-service.js";
import { sha256 } from "../src/hash.js";
import { ApprovedCodeDriftError, assertApprovedCodeIntegrity } from "../src/version-integrity.js";
import { approvedVersion, writeManifest, writeVersions } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("测试记录与报告", () => {
  it("从真实运行证据生成不可变记录和只读报告结论", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-test-record-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    await writeVersions(store, [approvedVersion({
      kind: "CODE",
      scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
    })]);
    await writeFile(path.join(workspace, "pnpm-lock.yaml"), "lockfileVersion: 9\n", "utf8");
    const runService = new RunService(store, {
      id: () => "run-1",
      now: () => "2026-08-11T05:00:00.000Z",
    });
    await runService.start({
      command: "/sdlc-test 系统管理",
      commandType: "MODULE_TEST",
      sessionId: "session-1",
      scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
      gitBase: "abc123",
      inputVersionIds: ["code-module-system-management-r1"],
      allowedProductPaths: [],
      allowedTestPaths: ["test/system-management"],
    });
    await new ControlledExecutionService(store, workspace, {
      id: () => "evidence-1",
      now: () => "2026-08-11T05:00:01.000Z",
    }).execute({
      runId: "run-1",
      executable: "node",
      arguments: ["-e", "process.exit(0)"],
      workingDirectory: ".",
      timeoutMs: 10_000,
    });
    await runService.finish("run-1", "SUCCEEDED");
    const record = await new TestRecordService(store, workspace, {
      id: () => "test-record-1",
      now: () => "2026-08-11T05:00:02.000Z",
    }).create({
      runId: "run-1",
      scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
      fingerprintPaths: ["pnpm-lock.yaml"],
      evidencePaths: [],
    });

    expect(record).toMatchObject({ outcome: "PASSED", passedCommands: 1, failedCommands: 0 });
    const report = await new VerificationReportService(store, workspace).generate([record.testRecordId]);
    expect(report.outcome).toBe("PASSED");
    await expect(readFile(path.join(workspace, report.targetPath), "utf8"))
      .resolves.toContain("本报告引用的测试记录全部通过");
  });

  it("自动纳入已批准代码和工具链文件，并在代码漂移后拒绝复用", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-test-record-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    await mkdir(path.join(workspace, "src", "system-management"), { recursive: true });
    await mkdir(path.join(workspace, "test", "system-management"), { recursive: true });
    const sourcePath = "src/system-management/index.ts";
    const sourceBytes = Buffer.from("export const value = 1;\n", "utf8");
    await writeFile(path.join(workspace, sourcePath), sourceBytes);
    await writeFile(path.join(workspace, "test/system-management/flow.test.ts"), "export const tested = true;\n", "utf8");
    await writeFile(path.join(workspace, "package.json"), "{\"private\":true}\n", "utf8");
    await writeFile(path.join(workspace, "vitest.config.ts"), "export default {};\n", "utf8");
    const code = approvedVersion({
      kind: "CODE",
      scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
    });
    code.subjectPaths = [sourcePath];
    code.subjects = [{
      path: sourcePath,
      sha256: sha256(sourceBytes),
      size: sourceBytes.byteLength,
      snapshotPath: ".sdlc-factory/revisions/code/source.ts",
    }];
    await writeVersions(store, [code]);
    const runService = new RunService(store, {
      id: () => "run-integrity",
      now: () => "2026-08-11T05:10:00.000Z",
    });
    await runService.start({
      command: "/sdlc-test 系统管理",
      commandType: "MODULE_TEST",
      sessionId: "session-integrity",
      scope: code.scope,
      gitBase: "abc123",
      inputVersionIds: [code.versionId],
      allowedProductPaths: [],
      allowedTestPaths: ["test/system-management"],
    });
    await new ControlledExecutionService(store, workspace, {
      id: () => "evidence-integrity",
      now: () => "2026-08-11T05:10:01.000Z",
    }).execute({
      runId: "run-integrity",
      executable: "node",
      arguments: ["-e", "process.exit(0)"],
      workingDirectory: ".",
      timeoutMs: 10_000,
    });
    await runService.finish("run-integrity", "SUCCEEDED");
    const service = new TestRecordService(store, workspace, {
      id: () => "test-record-integrity",
      now: () => "2026-08-11T05:10:02.000Z",
    });
    const record = await service.create({
      runId: "run-integrity",
      scope: code.scope,
      fingerprintPaths: [],
      evidencePaths: [],
    });

    expect(record.fingerprintFiles?.map((item) => item.path)).toEqual([
      "package.json",
      sourcePath,
      "test/system-management/flow.test.ts",
      "vitest.config.ts",
    ]);
    await writeFile(path.join(workspace, sourcePath), "export const value = 2;\n", "utf8");
    await expect(assertApprovedCodeIntegrity(store, workspace, [code.versionId]))
      .rejects.toBeInstanceOf(ApprovedCodeDriftError);
    await expect(service.findReusable(code.scope, [code.versionId], undefined, [], [{
      executable: "node",
      arguments: ["-e", "process.exit(0)"],
      workingDirectory: ".",
    }])).rejects.toBeInstanceOf(ApprovedCodeDriftError);
  });
});
