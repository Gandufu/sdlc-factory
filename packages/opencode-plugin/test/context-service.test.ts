import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ContextService } from "../src/context-service.js";
import type { ApprovedVersion, RequirementMapFacts } from "../src/domain.js";
import { sha256 } from "../src/hash.js";
import { ProjectStore } from "../src/project-store.js";
import { approvedVersion, writeVersions } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ContextService", () => {
  it("模块上下文保留版本引用但限制正文并去除同路径重复内容", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-context-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    const facts: RequirementMapFacts = {
      businessModules: [{
        moduleId: "device-info",
        name: "设备信息",
        slug: "device-info",
        goal: "查询设备信息",
        functionalGroups: ["设备查询"],
        dependencies: ["home-portal"],
        interfaceIds: ["device-api"],
        qualityIds: ["security", "fidelity"],
        status: "ACTIVE",
      }, {
        moduleId: "home-portal",
        name: "首页门户",
        slug: "home-portal",
        goal: "提供导航",
        functionalGroups: ["导航"],
        dependencies: [],
        interfaceIds: [],
        qualityIds: ["fidelity"],
        status: "ACTIVE",
      }],
      interfaces: [{ interfaceId: "device-api", name: "设备接口", slug: "device-api", scopeModuleIds: ["device-info"] }],
      qualityRequirements: [
        { qualityId: "security", name: "凭据安全", slug: "security", scope: "GLOBAL", scopeModuleIds: [] },
        { qualityId: "fidelity", name: "还原质量", slug: "fidelity", scope: "GLOBAL", scopeModuleIds: [] },
      ],
    };
    const versions: ApprovedVersion[] = [
      approvedVersion({ kind: "PRODUCT_BRIEF", scope: { type: "PROJECT", id: "project", name: "项目" } }),
      approvedVersion({ kind: "REQUIREMENT_MAP", scope: { type: "PROJECT", id: "project", name: "项目" }, facts }),
      approvedVersion({ kind: "REQUIREMENT_SET", scope: { type: "PROJECT", id: "project", name: "项目" } }),
      approvedVersion({ kind: "PRODUCT_ARCHITECTURE", scope: { type: "PROJECT", id: "project", name: "项目" } }),
      approvedVersion({ kind: "MODULE_REQUIREMENT", scope: { type: "MODULE", id: "device-info", name: "设备信息" } }),
      approvedVersion({ kind: "MODULE_REQUIREMENT", scope: { type: "MODULE", id: "home-portal", name: "首页门户" } }),
      approvedVersion({ kind: "INTERFACE_REQUIREMENT", scope: { type: "INTERFACE", id: "device-api", name: "设备接口" } }),
      approvedVersion({ kind: "QUALITY_REQUIREMENT", scope: { type: "QUALITY", id: "security", name: "凭据安全" } }),
      approvedVersion({ kind: "QUALITY_REQUIREMENT", scope: { type: "QUALITY", id: "fidelity", name: "还原质量" } }),
    ];
    const contents = new Map<string, string>([
      ["product-brief-project-r1", "产品".repeat(4_000)],
      ["requirement-map-project-r1", "地图".repeat(4_000)],
      ["requirement-set-project-r1", "集合".repeat(4_000)],
      ["product-architecture-project-r1", "架构".repeat(4_000)],
      ["module-requirement-device-info-r1", "当前模块".repeat(4_000)],
      ["module-requirement-home-portal-r1", "依赖模块".repeat(4_000)],
      ["interface-requirement-device-api-r1", "接口".repeat(4_000)],
      ["quality-requirement-security-r1", "旧质量".repeat(4_000)],
      ["quality-requirement-fidelity-r1", "最新质量".repeat(4_000)],
    ]);
    for (const version of versions) {
      const content = contents.get(version.versionId)!;
      const subjectPath = version.kind === "QUALITY_REQUIREMENT" ? "docs/requirements/quality/global.md" : `docs/${version.versionId}.md`;
      const snapshotPath = `.sdlc-factory/objects/${version.versionId}.md`;
      await mkdir(path.join(workspace, path.dirname(snapshotPath)), { recursive: true });
      await writeFile(path.join(workspace, snapshotPath), content, "utf8");
      version.subjectPaths = [subjectPath];
      version.subjects = [{
        path: subjectPath,
        sha256: sha256(Buffer.from(content, "utf8")),
        size: Buffer.byteLength(content),
        snapshotPath,
      }];
    }
    await writeVersions(store, versions);

    const result = await new ContextService(store).assemble("DESIGN", "设备信息", 16_000);
    const totalContent = result.items.reduce((sum, item) => sum + (item.content?.length ?? 0), 0);
    const byVersion = new Map(result.items.map((item) => [item.versionId, item]));

    expect(totalContent).toBeLessThanOrEqual(16_000);
    expect(Buffer.byteLength(JSON.stringify(result), "utf8")).toBeLessThanOrEqual(16_000);
    expect(byVersion.get("product-brief-project-r1")?.content).toBeUndefined();
    expect(byVersion.get("requirement-set-project-r1")?.content).toBeUndefined();
    expect(byVersion.get("module-requirement-home-portal-r1")?.content).toBeUndefined();
    expect(byVersion.get("module-requirement-home-portal-r1")?.contentMode).toBe("METADATA_ONLY");
    expect(byVersion.get("module-requirement-home-portal-r1")?.clipped).toBe(false);
    expect(byVersion.get("quality-requirement-security-r1")?.content).toBeUndefined();
    expect(byVersion.get("quality-requirement-fidelity-r1")?.content).toBeDefined();
    expect(byVersion.get("module-requirement-device-info-r1")?.content).toBeDefined();
  });
});
