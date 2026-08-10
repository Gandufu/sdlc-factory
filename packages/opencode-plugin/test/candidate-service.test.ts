import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CandidateService } from "../src/candidate-service.js";
import { ArtifactValidationError } from "../src/artifact-validator.js";
import { ProjectStore } from "../src/project-store.js";
import { requirementMapFacts } from "./fixtures.js";

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
    expect(candidate.subjects[0]!.snapshotPath).toContain(path.join("revisions", "candidate-1"));
    await expect(readFile(candidate.subjects[0]!.snapshotPath, "utf8")).resolves.toContain("产品目标");
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
});
