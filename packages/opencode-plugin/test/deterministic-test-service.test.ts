import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DeterministicTestService } from "../src/deterministic-test-service.js";
import type { CommandEvidence, EnvironmentVersion, TestRecord } from "../src/domain.js";
import { ProjectStore } from "../src/project-store.js";
import { approvedVersion, requirementMapFacts, writeManifest, writeVersions } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("DeterministicTestService", () => {
  it("从已批准系统测试提取命令配方并以零内部模型调用形成新记录", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-deterministic-test-"));
    temporaryDirectories.push(workspace);
    await mkdir(path.join(workspace, "src", "system-management"), { recursive: true });
    await mkdir(path.join(workspace, "test", "system-management"), { recursive: true });
    await writeFile(path.join(workspace, "src", "system-management", "index.js"), "export const value = 1;\n", "utf8");
    await writeFile(path.join(workspace, "test", "system-management", "pass.cjs"), "process.stdout.write('ok');\n", "utf8");
    initializeGit(workspace);

    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    const project = { type: "PROJECT" as const, id: "project", name: "项目" };
    const module = { type: "MODULE" as const, id: "module-system-management", name: "系统管理" };
    const brief = approvedVersion({ kind: "PRODUCT_BRIEF", scope: project });
    const map = approvedVersion({ kind: "REQUIREMENT_MAP", scope: project, facts: requirementMapFacts });
    const requirement = approvedVersion({
      kind: "MODULE_REQUIREMENT", scope: module, inputVersionIds: [map.versionId],
    });
    const interfaceRequirement = approvedVersion({
      kind: "INTERFACE_REQUIREMENT",
      scope: { type: "INTERFACE", id: "interface-identity", name: "统一身份接口" },
      inputVersionIds: [map.versionId],
    });
    const qualityRequirement = approvedVersion({
      kind: "QUALITY_REQUIREMENT",
      scope: { type: "QUALITY", id: "quality-security", name: "全局安全要求" },
      inputVersionIds: [map.versionId],
    });
    const requirementComponents = [brief, map, requirement, interfaceRequirement, qualityRequirement];
    const requirementSet = approvedVersion({
      kind: "REQUIREMENT_SET",
      scope: project,
      inputVersionIds: requirementComponents.map((version) => version.versionId),
      facts: { componentVersionIds: requirementComponents.map((version) => version.versionId) },
    });
    const architecture = approvedVersion({
      kind: "PRODUCT_ARCHITECTURE", scope: project, inputVersionIds: [requirementSet.versionId],
    });
    const design = approvedVersion({
      kind: "MODULE_DESIGN",
      scope: module,
      inputVersionIds: [requirementSet.versionId, requirement.versionId],
      facts: { productPaths: ["src/system-management"], testPaths: ["test/system-management"] },
    });
    const interfaceDesign = approvedVersion({
      kind: "INTERFACE_DESIGN",
      scope: interfaceRequirement.scope,
      inputVersionIds: [requirementSet.versionId, interfaceRequirement.versionId],
    });
    const designComponents = [requirementSet, architecture, design, interfaceDesign];
    const designSet = approvedVersion({
      kind: "DESIGN_SET",
      scope: project,
      inputVersionIds: designComponents.map((version) => version.versionId),
      facts: { componentVersionIds: designComponents.map((version) => version.versionId) },
    });
    const code = approvedVersion({
      kind: "CODE",
      scope: module,
      inputVersionIds: [requirementSet.versionId, designSet.versionId, requirement.versionId, design.versionId],
    });
    const moduleRecord = passingRecord("record-module", module, [designSet.versionId, design.versionId, code.versionId]);
    const moduleTest = approvedVersion({
      kind: "MODULE_TEST",
      scope: module,
      inputVersionIds: moduleRecord.inputVersionIds,
      testRecordIds: [moduleRecord.testRecordId],
    });
    const environment: EnvironmentVersion = {
      environmentVersionId: "environment-system-simulation-r1",
      environmentId: "system-simulation",
      name: "系统模拟环境",
      purpose: "只验证本地闭环，不代表真实验收",
      profile: "SIMULATION",
      revision: 1,
      applicationUrl: "app://test/index.html",
      externalInterfaces: [{ interfaceId: "interface-identity", address: "https://192.0.2.10" }],
      dependencies: [],
      credentialReferences: [],
      effectiveFrom: "2026-08-13T00:00:00.000Z",
      contentHash: "e".repeat(64),
      createdBySessionId: "session-environment",
      createdAt: "2026-08-13T00:00:00.000Z",
    };
    const systemInputs = [designSet.versionId, code.versionId, moduleTest.versionId];
    const systemRecord = passingRecord(
      "record-system-recipe",
      { type: "SYSTEM", id: "system", name: "系统" },
      systemInputs,
    );
    systemRecord.commandEvidenceIds = ["evidence-system-failed", "evidence-system-recipe"];
    systemRecord.failedCommands = 1;
    systemRecord.environmentVersionId = environment.environmentVersionId;
    systemRecord.environmentHash = environment.contentHash;
    const systemTest = approvedVersion({
      kind: "SYSTEM_TEST",
      scope: systemRecord.scope,
      inputVersionIds: systemInputs,
      testRecordIds: [systemRecord.testRecordId],
    });
    await writeVersions(store, [
      ...requirementComponents,
      requirementSet,
      architecture,
      design,
      interfaceDesign,
      designSet,
      code,
      moduleTest,
      systemTest,
    ]);
    await store.writeImmutable("environments", environment.environmentVersionId, environment);
    await store.writeImmutable("test-runs", moduleRecord.testRecordId, moduleRecord);
    await store.writeImmutable("test-runs", systemRecord.testRecordId, systemRecord);
    const recipeEvidence: CommandEvidence = {
      evidenceId: "evidence-system-recipe",
      runId: systemRecord.runId,
      executable: "node",
      arguments: ["test/system-management/pass.cjs"],
      workingDirectory: ".",
      timeoutMs: 10_000,
      exitCode: 0,
      timedOut: false,
      startedAt: "2026-08-13T00:00:01.000Z",
      finishedAt: "2026-08-13T00:00:02.000Z",
      durationMs: 1000,
      stdoutPath: "evidence/recipe/stdout.log",
      stdoutHash: "a".repeat(64),
      stderrPath: "evidence/recipe/stderr.log",
      stderrHash: "b".repeat(64),
    };
    await store.writeImmutable("command-evidence", "evidence-system-failed", {
      ...recipeEvidence,
      evidenceId: "evidence-system-failed",
      exitCode: 1,
      startedAt: "2026-08-13T00:00:00.000Z",
      finishedAt: "2026-08-13T00:00:00.500Z",
    });
    await store.writeImmutable("command-evidence", recipeEvidence.evidenceId, recipeEvidence);
    let sequence = 0;
    const runtime = {
      id: () => `generated-${++sequence}`,
      now: () => `2026-08-13T00:01:${String(sequence).padStart(2, "0")}.000Z`,
    };

    const service = new DeterministicTestService(store, workspace, runtime);
    const recipe = await service.readRecipe({ scopeType: "SYSTEM" });
    const result = await service.execute({
      scopeType: "SYSTEM",
      environmentVersionId: environment.environmentVersionId,
      createCandidate: false,
      sessionId: "session-zero-model",
    });

    expect(recipe).toMatchObject({
      testRecordId: systemRecord.testRecordId,
      commands: [{ executable: "node", arguments: ["test/system-management/pass.cjs"], timeoutMs: 10_000 }],
    });
    expect(result).toMatchObject({
      mode: "DETERMINISTIC_EXISTING_TEST",
      internalModelCalls: 0,
      recipeTestRecordId: systemRecord.testRecordId,
      record: { outcome: "PASSED", environmentVersionId: environment.environmentVersionId },
      execution: { state: "SUCCEEDED", attemptedCommands: 1, plannedCommands: 1 },
      recommendedAction: { action: "NONE" },
    });
    expect(result.candidate).toBeUndefined();
    await expect(store.listJson<TestRecord>("test-runs")).resolves.toHaveLength(3);

    await writeFile(path.join(workspace, "test", "system-management", "pass.cjs"), "process.exit(3);\n", "utf8");
    const failed = await service.execute({
      scopeType: "SYSTEM",
      recipeTestRecordId: systemRecord.testRecordId,
      environmentVersionId: environment.environmentVersionId,
      createCandidate: true,
      sessionId: "session-zero-model-failure",
    });

    expect(failed).toMatchObject({
      internalModelCalls: 0,
      record: { outcome: "FAILED", failedCommands: 1 },
      report: { outcome: "NOT_PASSED" },
      execution: { state: "FAILED", attemptedCommands: 1, plannedCommands: 1 },
      recommendedAction: { action: "DIAGNOSE" },
    });
    expect(failed.candidate).toBeUndefined();

    const designR2 = approvedVersion({
      kind: "MODULE_DESIGN",
      scope: module,
      revision: 2,
      inputVersionIds: [requirementSet.versionId, requirement.versionId],
      facts: { productPaths: ["src/system-management"], testPaths: ["test/system-management"] },
    });
    const designSetR2 = approvedVersion({
      kind: "DESIGN_SET",
      scope: project,
      revision: 2,
      inputVersionIds: [requirementSet.versionId, architecture.versionId, designR2.versionId, interfaceDesign.versionId],
      facts: {
        componentVersionIds: [requirementSet.versionId, architecture.versionId, designR2.versionId, interfaceDesign.versionId],
      },
    });
    await writeVersions(store, [designR2, designSetR2]);

    await expect(service.readRecipe({ scopeType: "SYSTEM" }))
      .rejects.toThrow("当前测试设计版本与批准命令配方不一致");
  });
});

function passingRecord(testRecordId: string, scope: TestRecord["scope"], inputVersionIds: string[]): TestRecord {
  return {
    testRecordId,
    scope,
    runId: `run-${testRecordId}`,
    outcome: "PASSED",
    inputVersionIds,
    resolvedAddresses: [],
    commandEvidenceIds: scope.type === "SYSTEM" ? ["evidence-system-recipe"] : [],
    passedCommands: 1,
    failedCommands: 0,
    skippedCommands: 0,
    blockedCommands: 0,
    assertionCountsAvailable: false,
    evidencePaths: [],
    fingerprint: "f".repeat(64),
    startedAt: "2026-08-13T00:00:01.000Z",
    finishedAt: "2026-08-13T00:00:02.000Z",
    createdAt: "2026-08-13T00:00:02.000Z",
  };
}

function initializeGit(workspace: string): void {
  for (const arguments_ of [
    ["init"],
    ["config", "user.email", "test@example.invalid"],
    ["config", "user.name", "SDLC Test"],
    ["add", "."],
    ["commit", "-m", "fixture"],
  ]) {
    const result = spawnSync("git", arguments_, { cwd: workspace, encoding: "utf8", windowsHide: true });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  }
}
