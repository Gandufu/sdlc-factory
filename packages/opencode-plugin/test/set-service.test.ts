import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectStore } from "../src/project-store.js";
import { SetService } from "../src/set-service.js";
import { approvedVersion, requirementMapFacts, writeVersions } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("SetService", () => {
  it("通过集合专用入口生成总需求版本候选", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-set-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    const project = { type: "PROJECT", id: "project", name: "项目" } as const;
    const brief = approvedVersion({ kind: "PRODUCT_BRIEF", scope: project });
    const map = approvedVersion({ kind: "REQUIREMENT_MAP", scope: project, facts: requirementMapFacts });
    const moduleRequirement = approvedVersion({
      kind: "MODULE_REQUIREMENT",
      scope: { type: "MODULE", id: "module-system-management", name: "系统管理" },
      inputVersionIds: [map.versionId],
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
    await writeVersions(store, [brief, map, moduleRequirement, interfaceRequirement, qualityRequirement]);

    const candidate = await new SetService(store, workspace, {
      id: () => "candidate-requirement-set",
      now: () => "2026-08-11T06:00:00.000Z",
    }).create({
      kind: "REQUIREMENT_SET",
      changeType: "STRUCTURE",
      changeSummary: "固定总需求基线",
      proposedImpactScopeIds: ["project"],
      sessionId: "session-spec",
    });

    expect(candidate.kind).toBe("REQUIREMENT_SET");
    expect(candidate.inputVersionIds).toEqual(expect.arrayContaining([
      brief.versionId,
      map.versionId,
      moduleRequirement.versionId,
      interfaceRequirement.versionId,
      qualityRequirement.versionId,
    ]));
    await expect(readFile(path.join(workspace, "docs", "requirements", "requirement-set.yaml"), "utf8"))
      .resolves.toContain("kind: REQUIREMENT_SET");
  });
});
