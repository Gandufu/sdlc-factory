import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ApprovedVersion, RequirementMapFacts, TestRecord } from "../src/domain.js";
import { sha256 } from "../src/hash.js";
import { ProjectStore } from "../src/project-store.js";
import { StatusService } from "../src/status-service.js";
import { approvedVersion, requirementMapFacts, writeManifest, writeVersions } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function lifecycleVersions(): ApprovedVersion[] {
  const project = { type: "PROJECT" as const, id: "project", name: "项目" };
  const module = { type: "MODULE" as const, id: "module-system-management", name: "系统管理" };
  const contract = { type: "INTERFACE" as const, id: "interface-identity", name: "统一身份接口" };
  const quality = { type: "QUALITY" as const, id: "quality-security", name: "全局安全要求" };
  const brief = approvedVersion({ kind: "PRODUCT_BRIEF", scope: project });
  const map = approvedVersion({ kind: "REQUIREMENT_MAP", scope: project, facts: requirementMapFacts });
  const moduleRequirement = approvedVersion({
    kind: "MODULE_REQUIREMENT", scope: module, inputVersionIds: [map.versionId],
  });
  const interfaceRequirement = approvedVersion({
    kind: "INTERFACE_REQUIREMENT", scope: contract, inputVersionIds: [map.versionId],
  });
  const qualityRequirement = approvedVersion({
    kind: "QUALITY_REQUIREMENT", scope: quality, inputVersionIds: [map.versionId],
  });
  const requirementComponents = [brief, map, moduleRequirement, interfaceRequirement, qualityRequirement];
  const requirementSet = approvedVersion({
    kind: "REQUIREMENT_SET",
    scope: project,
    inputVersionIds: requirementComponents.map((version) => version.versionId),
    facts: { componentVersionIds: requirementComponents.map((version) => version.versionId) },
  });
  const architecture = approvedVersion({
    kind: "PRODUCT_ARCHITECTURE", scope: project, inputVersionIds: [requirementSet.versionId],
  });
  const moduleDesign = approvedVersion({
    kind: "MODULE_DESIGN",
    scope: module,
    inputVersionIds: [requirementSet.versionId, moduleRequirement.versionId],
    facts: { productPaths: ["src/system-management"], testPaths: ["test/system-management"] },
  });
  const interfaceDesign = approvedVersion({
    kind: "INTERFACE_DESIGN",
    scope: contract,
    inputVersionIds: [requirementSet.versionId, interfaceRequirement.versionId],
  });
  const designComponents = [requirementSet, architecture, moduleDesign, interfaceDesign];
  const designSet = approvedVersion({
    kind: "DESIGN_SET",
    scope: project,
    inputVersionIds: designComponents.map((version) => version.versionId),
    facts: { componentVersionIds: designComponents.map((version) => version.versionId) },
  });
  return [...requirementComponents, requirementSet, architecture, moduleDesign, interfaceDesign, designSet];
}

describe("StatusService", () => {
  it("总设计批准前不生成完整项目进度", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-status-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    await writeVersions(store, lifecycleVersions().filter((version) => version.kind !== "DESIGN_SET"));

    const status = await new StatusService(store).read();

    expect(status.projectProgressAvailable).toBe(false);
    expect(status.modules).toBeUndefined();
    expect(status.gates).toContain("总设计版本尚未批准或已失效");
  });

  it("总设计批准后按业务模块推导最新阶段、版本和唯一建议", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-status-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    await writeVersions(store, lifecycleVersions());

    const status = await new StatusService(store).read();

    expect(status.projectProgressAvailable).toBe(true);
    expect(status.modules).toEqual([
      expect.objectContaining({
        moduleId: "module-system-management",
        moduleName: "系统管理",
        stage: "CODING",
        state: "NOT_STARTED",
        recommendedCommand: "/sdlc-code 系统管理",
      }),
    ]);
    expect(status.recommendedAction.command).toBe("/sdlc-code 系统管理");
  });

  it("部分模块已具备系统测试条件时仍优先推进其他未完成模块", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-status-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    const versions = lifecycleVersions();
    const map = versions.find((version) => version.kind === "REQUIREMENT_MAP")!;
    const mapFacts = structuredClone(map.facts) as RequirementMapFacts;
    mapFacts.businessModules.push({
      moduleId: "module-audit-management",
      name: "审计管理",
      slug: "audit-management",
      goal: "查询系统操作审计记录",
      functionalGroups: ["审计查询"],
      dependencies: ["module-system-management"],
      interfaceIds: [],
      qualityIds: ["quality-security"],
      status: "ACTIVE",
    });
    map.facts = mapFacts;
    const requirementSet = versions.find((version) => version.kind === "REQUIREMENT_SET")!;
    const designSet = versions.find((version) => version.kind === "DESIGN_SET")!;
    const systemRequirement = versions.find((version) => version.kind === "MODULE_REQUIREMENT")!;
    const systemDesign = versions.find((version) => version.kind === "MODULE_DESIGN")!;
    const auditScope = { type: "MODULE", id: "module-audit-management", name: "审计管理" } as const;
    const auditRequirement = approvedVersion({
      kind: "MODULE_REQUIREMENT", scope: auditScope, inputVersionIds: [map.versionId],
    });
    const auditDesign = approvedVersion({
      kind: "MODULE_DESIGN",
      scope: auditScope,
      inputVersionIds: [requirementSet.versionId, auditRequirement.versionId],
      facts: { productPaths: ["src/audit-management"], testPaths: ["test/audit-management"] },
    });
    requirementSet.inputVersionIds.push(auditRequirement.versionId);
    (requirementSet.facts as { componentVersionIds: string[] }).componentVersionIds.push(auditRequirement.versionId);
    designSet.inputVersionIds.push(auditDesign.versionId);
    (designSet.facts as { componentVersionIds: string[] }).componentVersionIds.push(auditDesign.versionId);
    const systemCode = approvedVersion({
      kind: "CODE",
      scope: systemRequirement.scope,
      inputVersionIds: [requirementSet.versionId, designSet.versionId, systemRequirement.versionId, systemDesign.versionId],
    });
    const recordId = "test-record-system-management";
    const systemTest = approvedVersion({
      kind: "MODULE_TEST",
      scope: systemRequirement.scope,
      inputVersionIds: [designSet.versionId, systemDesign.versionId, systemCode.versionId],
      testRecordIds: [recordId],
    });
    await writeVersions(store, [...versions, auditRequirement, auditDesign, systemCode, systemTest]);
    const record: TestRecord = {
      testRecordId: recordId,
      scope: systemRequirement.scope,
      runId: "run-system-management",
      outcome: "PASSED",
      inputVersionIds: systemTest.inputVersionIds,
      resolvedAddresses: [],
      commandEvidenceIds: ["evidence-system-management"],
      passedCommands: 1,
      failedCommands: 0,
      skippedCommands: 0,
      blockedCommands: 0,
      assertionCountsAvailable: false,
      evidencePaths: [],
      fingerprint: "f".repeat(64),
      startedAt: "2026-08-11T05:00:00.000Z",
      finishedAt: "2026-08-11T05:00:01.000Z",
      createdAt: "2026-08-11T05:00:01.000Z",
    };
    await store.writeImmutable("test-runs", record.testRecordId, record);

    const status = await new StatusService(store).read();

    expect(status.modules).toEqual([
      expect.objectContaining({ moduleName: "系统管理", stage: "SYSTEM_TEST" }),
      expect.objectContaining({ moduleName: "审计管理", stage: "CODING" }),
    ]);
    expect(status.recommendedAction.command).toBe("/sdlc-code 审计管理");
  });

  it("系统测试通过后模块显示已完成测试并只推荐形成系统验收候选", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-status-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    const versions = lifecycleVersions();
    const requirementSet = versions.find((version) => version.kind === "REQUIREMENT_SET")!;
    const designSet = versions.find((version) => version.kind === "DESIGN_SET")!;
    const requirement = versions.find((version) => version.kind === "MODULE_REQUIREMENT")!;
    const design = versions.find((version) => version.kind === "MODULE_DESIGN")!;
    const code = approvedVersion({
      kind: "CODE",
      scope: requirement.scope,
      inputVersionIds: [requirementSet.versionId, designSet.versionId, requirement.versionId, design.versionId],
    });
    const sourcePath = "src/system-management/index.ts";
    const sourceBytes = Buffer.from("export const value = 1;\n", "utf8");
    await mkdir(path.join(workspace, "src", "system-management"), { recursive: true });
    await writeFile(path.join(workspace, sourcePath), sourceBytes);
    code.subjectPaths = [sourcePath];
    code.subjects = [{
      path: sourcePath,
      sha256: sha256(sourceBytes),
      size: sourceBytes.byteLength,
      snapshotPath: ".sdlc-factory/revisions/code/0001.snapshot",
    }];
    const moduleRecordId = "test-record-module";
    const moduleTest = approvedVersion({
      kind: "MODULE_TEST",
      scope: requirement.scope,
      inputVersionIds: [designSet.versionId, design.versionId, code.versionId],
      testRecordIds: [moduleRecordId],
    });
    const systemRecordId = "test-record-system";
    const systemTest = approvedVersion({
      kind: "SYSTEM_TEST",
      scope: { type: "SYSTEM", id: "system", name: "系统" },
      inputVersionIds: [designSet.versionId, code.versionId, moduleTest.versionId],
      testRecordIds: [systemRecordId],
    });
    await writeVersions(store, [...versions, code, moduleTest, systemTest]);
    const record = (testRecordId: string, scope: TestRecord["scope"], inputVersionIds: string[]): TestRecord => ({
      testRecordId,
      scope,
      runId: `run-${testRecordId}`,
      outcome: "PASSED",
      inputVersionIds,
      resolvedAddresses: [],
      commandEvidenceIds: [`evidence-${testRecordId}`],
      passedCommands: 1,
      failedCommands: 0,
      skippedCommands: 0,
      blockedCommands: 0,
      assertionCountsAvailable: false,
      fingerprintFiles: [{ path: sourcePath, sha256: sha256(sourceBytes), size: sourceBytes.byteLength }],
      evidencePaths: [],
      fingerprint: "f".repeat(64),
      startedAt: "2026-08-11T05:00:00.000Z",
      finishedAt: "2026-08-11T05:00:01.000Z",
      createdAt: "2026-08-11T05:00:01.000Z",
    });
    await store.writeImmutable("test-runs", moduleRecordId, record(moduleRecordId, requirement.scope, moduleTest.inputVersionIds));
    await store.writeImmutable("test-runs", systemRecordId, record(systemRecordId, systemTest.scope, systemTest.inputVersionIds));

    const status = await new StatusService(store).read();

    expect(status.systemTestVersionId).toBe(systemTest.versionId);
    expect(status.systemTestRecordIds).toEqual([systemRecordId]);
    expect(status.modules).toEqual([
      expect.objectContaining({ stage: "SYSTEM_TEST", state: "COMPLETED", systemTestResult: "PASSED" }),
    ]);
    expect(status.recommendedAction).toMatchObject({ action: "SYSTEM_ACCEPTANCE", command: "/sdlc-test system" });

    await writeFile(path.join(workspace, sourcePath), "export const value = 2;\n", "utf8");
    const drifted = await new StatusService(store).read();
    expect(drifted.systemTestVersionId).toBeUndefined();
    expect(drifted.modules).toEqual([
      expect.objectContaining({ stage: "CODING", state: "INVALIDATED", codeVersionId: code.versionId }),
    ]);
    expect(drifted.recommendedAction.command).toBe("/sdlc-code 系统管理");
  });

  it("上游模块设计修订后旧总设计自动失效，无需修改进度投影", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-status-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    const versions = lifecycleVersions();
    await writeVersions(store, versions);
    const previous = versions.find((version) => version.kind === "MODULE_DESIGN")!;
    expect(previous.facts).toBeDefined();
    await writeVersions(store, [approvedVersion({
      kind: "MODULE_DESIGN",
      scope: previous.scope,
      revision: 2,
      inputVersionIds: previous.inputVersionIds,
      facts: previous.facts!,
    })]);

    const status = await new StatusService(store).read();

    expect(status.projectProgressAvailable).toBe(false);
    expect(status.designSetVersionId).toBeUndefined();
  });
});
