import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CandidateService } from "../src/candidate-service.js";
import { ArtifactValidationError } from "../src/artifact-validator.js";
import { sha256 } from "../src/hash.js";
import { ProjectStore } from "../src/project-store.js";
import type { RunRecord, TestRecord } from "../src/domain.js";
import { approvedVersion, requirementMapFacts, writeVersions } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function runtime(id: string) {
  return { id: () => id, now: () => "2026-08-11T05:00:00.000Z" };
}

describe("CandidateService", () => {
  it("按规范化顺序绑定工作区字节并保存不可变快照", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-candidate-"));
    temporaryDirectories.push(workspace);
    await mkdir(path.join(workspace, "docs", "requirements"), { recursive: true });
    await writeFile(path.join(workspace, "docs", "requirements", "product-brief.md"), [
      "# 产品概述",
      "## 产品目标",
      "## 系统边界",
      "## 主要角色",
      "## 业务模块",
      "## 未知",
      "",
    ].join("\n"), "utf8");
    const service = new CandidateService(new ProjectStore(workspace), workspace, runtime("candidate-1"));

    const candidate = await service.create({
      kind: "PRODUCT_BRIEF",
      scope: { type: "PROJECT", id: "project", name: "项目" },
      subjectPaths: ["docs/requirements/product-brief.md"],
      inputVersionIds: [],
      sourceIds: [],
      testRecordIds: [],
      changeType: "STRUCTURE",
      changeSummary: "建立产品概述",
      proposedImpactScopeIds: [],
      createdBySessionId: "session-1",
    });

    expect(candidate.revision).toBe(1);
    expect(path.isAbsolute(candidate.subjects[0]!.snapshotPath)).toBe(false);
    expect(candidate.subjects[0]!.snapshotPath).toContain("revisions/candidate-1");
    expect(candidate.subjects[0]!.snapshotPath).toMatch(/0001\.snapshot$/u);
    await expect(readFile(path.join(workspace, candidate.subjects[0]!.snapshotPath), "utf8"))
      .resolves.toContain("产品目标");
  });

  it("校验需求地图结构化事实并拒绝遗留概念", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-candidate-"));
    temporaryDirectories.push(workspace);
    await mkdir(path.join(workspace, "docs", "requirements"), { recursive: true });
    await writeFile(path.join(workspace, "docs", "requirements", "requirement-map.md"), [
      "# 需求地图",
      "## 业务模块",
      "## 功能组",
      "## 执行依赖",
      "## 外部接口",
      "## 非功能需求",
      "旧能力单元",
      "",
    ].join("\n"), "utf8");
    const service = new CandidateService(new ProjectStore(workspace), workspace, runtime("candidate-map"));

    await expect(service.create({
      kind: "REQUIREMENT_MAP",
      scope: { type: "PROJECT", id: "project", name: "项目" },
      subjectPaths: ["docs/requirements/requirement-map.md"],
      inputVersionIds: [],
      sourceIds: [],
      testRecordIds: [],
      changeType: "STRUCTURE",
      changeSummary: "建立业务模块",
      proposedImpactScopeIds: [],
      facts: requirementMapFacts,
      createdBySessionId: "session-1",
    })).rejects.toBeInstanceOf(ArtifactValidationError);
  });

  it("拒绝重复候选路径", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-candidate-"));
    temporaryDirectories.push(workspace);
    const service = new CandidateService(new ProjectStore(workspace), workspace, runtime("candidate-duplicate"));

    await expect(service.create({
      kind: "PRODUCT_BRIEF",
      scope: { type: "PROJECT", id: "project", name: "项目" },
      subjectPaths: ["docs/requirements/product-brief.md", "docs\\requirements\\product-brief.md"],
      inputVersionIds: [],
      sourceIds: [],
      testRecordIds: [],
      changeType: "EDITORIAL",
      changeSummary: "重复路径",
      proposedImpactScopeIds: [],
      createdBySessionId: "session-1",
    })).rejects.toThrow("不能重复");
  });

  it("模块测试候选不得重复纳入测试说明等批准测试路径外文件", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-candidate-"));
    temporaryDirectories.push(workspace);
    await mkdir(path.join(workspace, "docs", "verification", "modules", "system-management"), { recursive: true });
    await mkdir(path.join(workspace, "tests", "system-management"), { recursive: true });
    await writeFile(path.join(workspace, "docs", "verification", "modules", "system-management", "verification-spec.md"), "# 测试说明\n", "utf8");
    await writeFile(path.join(workspace, "tests", "system-management", "domain.test.ts"), "export {};\n", "utf8");
    const store = new ProjectStore(workspace);
    const moduleScope = { type: "MODULE", id: "module-system-management", name: "系统管理" } as const;
    const map = approvedVersion({
      kind: "REQUIREMENT_MAP",
      scope: { type: "PROJECT", id: "project", name: "项目" },
      facts: requirementMapFacts,
    });
    const design = approvedVersion({
      kind: "MODULE_DESIGN",
      scope: moduleScope,
      facts: { productPaths: ["src/system-management"], testPaths: ["tests/system-management"] },
    });
    const designSet = approvedVersion({
      kind: "DESIGN_SET", scope: { type: "PROJECT", id: "project", name: "项目" },
    });
    const code = approvedVersion({ kind: "CODE", scope: moduleScope });
    await writeVersions(store, [map, design, designSet, code]);
    const run: RunRecord = {
      runId: "run-module-test",
      command: "/sdlc-test 系统管理",
      commandType: "MODULE_TEST",
      sessionId: "session-test",
      scope: moduleScope,
      gitBase: "a".repeat(40),
      inputVersionIds: [designSet.versionId, design.versionId, code.versionId],
      allowedProductPaths: ["src/system-management"],
      allowedTestPaths: ["tests/system-management"],
      createdAt: "2026-08-11T05:00:00.000Z",
    };
    await store.writeImmutable("runs", run.runId, run);
    await store.appendJournal({
      type: "RUN_FINISHED", at: "2026-08-11T05:00:01.000Z", runId: run.runId, state: "SUCCEEDED",
    });
    const record: TestRecord = {
      testRecordId: "test-record-module",
      scope: moduleScope,
      runId: run.runId,
      outcome: "PASSED",
      inputVersionIds: run.inputVersionIds,
      resolvedAddresses: [],
      commandEvidenceIds: ["evidence-module"],
      passedCommands: 1,
      failedCommands: 0,
      skippedCommands: 0,
      blockedCommands: 0,
      assertionCountsAvailable: false,
      evidencePaths: [],
      fingerprint: "f".repeat(64),
      startedAt: run.createdAt,
      finishedAt: "2026-08-11T05:00:01.000Z",
      createdAt: "2026-08-11T05:00:01.000Z",
    };
    await store.writeImmutable("test-runs", record.testRecordId, record);

    await expect(new CandidateService(store, workspace, runtime("candidate-module-test")).create({
      kind: "MODULE_TEST",
      scope: moduleScope,
      subjectPaths: [
        "docs/verification/modules/system-management/verification-spec.md",
        "tests/system-management/domain.test.ts",
      ],
      inputVersionIds: run.inputVersionIds,
      sourceIds: [],
      testRecordIds: [record.testRecordId],
      changeType: "BEHAVIOR",
      changeSummary: "模块测试通过",
      proposedImpactScopeIds: [],
      provenance: {
        runId: run.runId,
        gitBase: run.gitBase,
        inputVersionIds: run.inputVersionIds,
        testRecordIds: [record.testRecordId],
      },
      createdBySessionId: run.sessionId,
    })).rejects.toThrow("模块测试候选文件超出模块设计批准的测试路径边界");
  });

  it("系统验收直接复用当前系统测试的通过记录，不伪造第二次可执行运行", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-candidate-"));
    temporaryDirectories.push(workspace);
    await mkdir(path.join(workspace, "docs", "verification"), { recursive: true });
    const reportBytes = Buffer.from([
      "# 系统测试报告", "## 报告结论", "## 输入版本", "## 环境与实际接口地址", "## 测试记录",
      "## 失败、跳过、阻塞和缺失证据", "## 人工检查项", "",
    ].join("\n"), "utf8");
    await writeFile(path.join(workspace, "docs", "verification", "verification-report.md"), reportBytes);
    const store = new ProjectStore(workspace);
    const systemTest = approvedVersion({
      kind: "SYSTEM_TEST",
      scope: { type: "SYSTEM", id: "system", name: "系统" },
      testRecordIds: ["test-record-system"],
    });
    systemTest.subjectPaths = ["docs/verification/verification-report.md"];
    systemTest.subjects = [{
      path: "docs/verification/verification-report.md",
      sha256: sha256(reportBytes),
      size: reportBytes.byteLength,
      snapshotPath: ".sdlc-factory/revisions/system-test/0001.snapshot",
    }];
    await writeVersions(store, [systemTest]);
    const record: TestRecord = {
      testRecordId: "test-record-system",
      scope: { type: "SYSTEM", id: "system", name: "系统" },
      runId: "run-system-test",
      outcome: "PASSED",
      inputVersionIds: [],
      resolvedAddresses: [],
      commandEvidenceIds: ["evidence-system-test"],
      passedCommands: 1,
      failedCommands: 0,
      skippedCommands: 0,
      blockedCommands: 0,
      assertionCountsAvailable: false,
      fingerprintFiles: [],
      evidencePaths: [],
      fingerprint: "f".repeat(64),
      startedAt: "2026-08-11T05:00:00.000Z",
      finishedAt: "2026-08-11T05:00:01.000Z",
      createdAt: "2026-08-11T05:00:01.000Z",
    };
    await store.writeImmutable("test-runs", record.testRecordId, record);

    const service = new CandidateService(store, workspace, runtime("candidate-acceptance"));
    const candidate = await service.createSystemAcceptance("session-acceptance");

    expect(candidate.provenance).toBeUndefined();
    expect(candidate.inputVersionIds).toEqual([systemTest.versionId]);
    expect(candidate.testRecordIds).toEqual([record.testRecordId]);
    expect(candidate.subjectPaths).toEqual(["docs/verification/verification-report.md"]);

    await expect(service.create({
      kind: "SYSTEM_ACCEPTANCE",
      scope: { type: "SYSTEM", id: "system", name: "系统" },
      subjectPaths: ["docs/verification/verification-report.md"],
      inputVersionIds: [systemTest.versionId],
      sourceIds: [],
      testRecordIds: [record.testRecordId],
      changeType: "CLARIFICATION",
      changeSummary: "绕过专用入口",
      proposedImpactScopeIds: [],
      createdBySessionId: "session-acceptance",
    })).rejects.toThrow("sdlc_system_acceptance_candidate_create");

    await writeFile(path.join(workspace, "docs", "verification", "verification-report.md"), "# 已修改\n", "utf8");
    await expect(service.createSystemAcceptance("session-acceptance"))
      .rejects.toThrow("当前系统测试报告与已批准版本不一致");
  });
});
