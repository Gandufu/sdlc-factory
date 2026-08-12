import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ApprovedVersion, EnvironmentVersion, RequirementMapFacts, TestRecord } from "../src/domain.js";
import { ProjectStore } from "../src/project-store.js";
import { StatusService } from "../src/status-service.js";
import { approvedVersion, writeManifest, writeVersions } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("双业务模块生命周期重建", () => {
  it("从需求、设计、代码、测试和验收事实重建完整项目完成状态", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-lifecycle-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await writeManifest(store, workspace);
    const project = { type: "PROJECT" as const, id: "project", name: "项目" };
    const system = { type: "SYSTEM" as const, id: "system", name: "系统" };
    const mapFacts: RequirementMapFacts = {
      businessModules: [
        {
          moduleId: "module-system-management",
          name: "系统管理",
          slug: "system-management",
          goal: "管理用户和权限",
          functionalGroups: ["用户管理", "角色权限"],
          dependencies: [],
          interfaceIds: [],
          qualityIds: [],
          status: "ACTIVE",
        },
        {
          moduleId: "module-audit-management",
          name: "审计管理",
          slug: "audit-management",
          goal: "查询关键操作记录",
          functionalGroups: ["审计查询"],
          dependencies: ["module-system-management"],
          interfaceIds: [],
          qualityIds: [],
          status: "ACTIVE",
        },
      ],
      interfaces: [],
      qualityRequirements: [],
    };
    const brief = approvedVersion({ kind: "PRODUCT_BRIEF", scope: project });
    const map = approvedVersion({ kind: "REQUIREMENT_MAP", scope: project, facts: mapFacts });
    const requirementVersions = mapFacts.businessModules.map((module) => approvedVersion({
      kind: "MODULE_REQUIREMENT",
      scope: { type: "MODULE", id: module.moduleId, name: module.name },
      inputVersionIds: [map.versionId],
    }));
    const requirementComponents = [brief, map, ...requirementVersions];
    const requirementSet = approvedVersion({
      kind: "REQUIREMENT_SET",
      scope: project,
      inputVersionIds: requirementComponents.map((version) => version.versionId),
      facts: { componentVersionIds: requirementComponents.map((version) => version.versionId) },
    });
    const architecture = approvedVersion({
      kind: "PRODUCT_ARCHITECTURE", scope: project, inputVersionIds: [requirementSet.versionId],
    });
    const designVersions = mapFacts.businessModules.map((module, index) => approvedVersion({
      kind: "MODULE_DESIGN",
      scope: { type: "MODULE", id: module.moduleId, name: module.name },
      inputVersionIds: [requirementSet.versionId, requirementVersions[index]!.versionId],
      facts: { productPaths: [`src/${module.slug}`], testPaths: [`test/${module.slug}`] },
    }));
    const designComponents = [requirementSet, architecture, ...designVersions];
    const designSet = approvedVersion({
      kind: "DESIGN_SET",
      scope: project,
      inputVersionIds: designComponents.map((version) => version.versionId),
      facts: { componentVersionIds: designComponents.map((version) => version.versionId) },
    });
    const codeVersions: ApprovedVersion[] = [];
    for (let index = 0; index < mapFacts.businessModules.length; index += 1) {
      const module = mapFacts.businessModules[index]!;
      codeVersions.push(approvedVersion({
        kind: "CODE",
        scope: { type: "MODULE", id: module.moduleId, name: module.name },
        inputVersionIds: [
          requirementSet.versionId,
          designSet.versionId,
          requirementVersions[index]!.versionId,
          designVersions[index]!.versionId,
          ...module.dependencies.map((dependencyId) => codeVersions.find((version) => version.scope.id === dependencyId)!.versionId),
        ],
      }));
    }
    const testRecords: TestRecord[] = mapFacts.businessModules.map((module, index) => testRecord(
      `test-record-module-${index + 1}`,
      { type: "MODULE", id: module.moduleId, name: module.name },
      [
        codeVersions[index]!.versionId,
        designVersions[index]!.versionId,
        designSet.versionId,
        ...module.dependencies.map((dependencyId) => codeVersions.find((version) => version.scope.id === dependencyId)!.versionId),
      ],
    ));
    for (const record of testRecords) await store.writeImmutable("test-runs", record.testRecordId, record);
    const moduleTests = mapFacts.businessModules.map((module, index) => approvedVersion({
      kind: "MODULE_TEST",
      scope: { type: "MODULE", id: module.moduleId, name: module.name },
      inputVersionIds: [
        codeVersions[index]!.versionId,
        designVersions[index]!.versionId,
        designSet.versionId,
        ...module.dependencies.map((dependencyId) => codeVersions.find((version) => version.scope.id === dependencyId)!.versionId),
      ],
      testRecordIds: [testRecords[index]!.testRecordId],
    }));
    const systemRecord = testRecord("test-record-system", system, [
      designSet.versionId,
      ...codeVersions.map((version) => version.versionId),
      ...moduleTests.map((version) => version.versionId),
    ]);
    const realEnvironment: EnvironmentVersion = {
      environmentVersionId: "environment-real-r1",
      environmentId: "real",
      name: "真实系统环境",
      purpose: "真实系统测试与验收",
      profile: "REAL",
      revision: 1,
      applicationUrl: "https://app.example.test",
      externalInterfaces: [],
      dependencies: [],
      credentialReferences: [],
      effectiveFrom: "2026-08-11T05:00:00.000Z",
      contentHash: "e".repeat(64),
      createdBySessionId: "session-environment",
      createdAt: "2026-08-11T05:00:00.000Z",
    };
    await store.writeImmutable("environments", realEnvironment.environmentVersionId, realEnvironment);
    systemRecord.environmentVersionId = realEnvironment.environmentVersionId;
    systemRecord.environmentHash = realEnvironment.contentHash;
    systemRecord.resolvedAddresses = [realEnvironment.applicationUrl!];
    await store.writeImmutable("test-runs", systemRecord.testRecordId, systemRecord);
    const systemTest = approvedVersion({
      kind: "SYSTEM_TEST",
      scope: system,
      inputVersionIds: systemRecord.inputVersionIds,
      testRecordIds: [systemRecord.testRecordId],
    });
    const acceptance = approvedVersion({
      kind: "SYSTEM_ACCEPTANCE",
      scope: system,
      inputVersionIds: [systemTest.versionId],
      testRecordIds: [systemRecord.testRecordId],
    });
    const versions: ApprovedVersion[] = [
      ...requirementComponents,
      requirementSet,
      architecture,
      ...designVersions,
      designSet,
      ...codeVersions,
      ...moduleTests,
      systemTest,
      acceptance,
    ];
    await writeVersions(store, versions);

    const first = await new StatusService(store).read();
    const afterRestart = await new StatusService(new ProjectStore(workspace)).read();

    expect(first.lifecyclePhase).toBe("已验收");
    expect(first.modules).toHaveLength(2);
    expect(first.modules?.every((module) => module.state === "COMPLETED")).toBe(true);
    expect(first.recommendedAction.command).toBe("/sdlc-status");
    expect(afterRestart).toEqual(first);
  });
});

function testRecord(testRecordId: string, scope: TestRecord["scope"], inputVersionIds: string[]): TestRecord {
  return {
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
    evidencePaths: [],
    fingerprint: "f".repeat(64),
    startedAt: "2026-08-11T05:00:00.000Z",
    finishedAt: "2026-08-11T05:00:01.000Z",
    createdAt: "2026-08-11T05:00:01.000Z",
  };
}
