import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ApprovedVersion } from "../src/domain.js";
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
