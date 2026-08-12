import { readFile } from "node:fs/promises";

import { currentVersion } from "./candidate-service.js";
import { findRequirementMap } from "./artifact-validator.js";
import type { ApprovedVersion } from "./domain.js";
import type { ProjectStore } from "./project-store.js";
import { resolveStoredSnapshotPath } from "./workspace-path.js";

type ContextWorkflow = "SPEC" | "DESIGN" | "CODE" | "MODULE_TEST" | "SYSTEM_TEST";

export type ContextItem = {
  versionId: string;
  kind: string;
  scopeId: string;
  path: string;
  sha256: string;
  includedReason: string;
  content?: string;
  contentMode: "FULL" | "TRUNCATED" | "METADATA_ONLY";
  clipped: boolean;
};

export class ContextService {
  constructor(private readonly store: ProjectStore) {}

  async assemble(
    workflow: ContextWorkflow,
    moduleName: string | undefined,
    maxTotalCharacters: number,
  ): Promise<{ workflow: ContextWorkflow; moduleId?: string; items: ContextItem[]; clipped: boolean }> {
    if (maxTotalCharacters < 4_000 || maxTotalCharacters > 30_000) {
      throw new Error("最小上下文字符上限必须在 4000 到 30000 之间");
    }
    const versions = await this.store.listJson<ApprovedVersion>("approved-versions");
    const map = findRequirementMap(versions);
    const module = moduleName ? map?.businessModules.find((item) => item.name === moduleName) : undefined;
    if (moduleName && !module) throw new Error(`业务模块名称不存在: ${moduleName}`);
    const selected = new Map<string, {
      version: ApprovedVersion;
      reason: string;
      includeContent: boolean;
      priority: number;
    }>();
    const add = (
      version: ApprovedVersion | undefined,
      reason: string,
      includeContent = true,
      priority = 50,
    ) => {
      if (version) selected.set(version.versionId, { version, reason, includeContent, priority });
    };
    add(currentVersion(versions, "PRODUCT_BRIEF", "project"), "产品公共边界", !module, 20);
    add(currentVersion(versions, "REQUIREMENT_MAP", "project"), "目标模块和直接关系", !module, 30);

    if (workflow !== "SPEC") add(currentVersion(versions, "REQUIREMENT_SET", "project"), "精确总需求输入", false);
    if (["CODE", "MODULE_TEST", "SYSTEM_TEST"].includes(workflow)) {
      add(currentVersion(versions, "DESIGN_SET", "project"), "精确总设计输入", false);
    }
    if (["DESIGN", "CODE", "MODULE_TEST", "SYSTEM_TEST"].includes(workflow)) {
      add(currentVersion(versions, "PRODUCT_ARCHITECTURE", "project"), "跨模块设计约束", true, 60);
    }

    if (module && map) {
      add(currentVersion(versions, "MODULE_REQUIREMENT", module.moduleId), "当前业务模块需求", true, 90);
      if (workflow !== "SPEC") {
        add(currentVersion(versions, "MODULE_DESIGN", module.moduleId), "当前业务模块设计和测试说明", true, 100);
      }
      if (["CODE", "MODULE_TEST"].includes(workflow)) {
        add(currentVersion(versions, "CODE", module.moduleId), "当前业务模块代码版本清单", false);
      }
      for (const interfaceId of module.interfaceIds) {
        add(currentVersion(versions, "INTERFACE_REQUIREMENT", interfaceId), "当前模块引用的外部接口需求", true, 80);
        if (workflow !== "SPEC") {
          add(currentVersion(versions, "INTERFACE_DESIGN", interfaceId), "当前模块引用的接口设计", true, 85);
        }
      }
      for (const quality of map.qualityRequirements.filter((item) => item.scope === "GLOBAL" || item.scopeModuleIds.includes(module.moduleId))) {
        add(currentVersion(versions, "QUALITY_REQUIREMENT", quality.qualityId), "当前模块适用的非功能需求", true, 70);
      }
      for (const dependencyId of module.dependencies) {
        add(currentVersion(versions, "MODULE_REQUIREMENT", dependencyId), "直接依赖模块需求", false, 10);
        if (["CODE", "MODULE_TEST"].includes(workflow)) {
          add(currentVersion(versions, "CODE", dependencyId), "直接依赖模块代码版本清单", false, 10);
        }
      }
    }

    if (workflow === "SYSTEM_TEST" && map) {
      for (const businessModule of map.businessModules.filter((item) => item.status === "ACTIVE")) {
        add(currentVersion(versions, "CODE", businessModule.moduleId), "系统测试参与模块代码版本清单", false);
        add(currentVersion(versions, "MODULE_TEST", businessModule.moduleId), "系统测试参与模块测试结果", false);
      }
    }

    const descriptors = [...selected.values()].flatMap(({ version, reason, includeContent, priority }) =>
      version.subjects.map((subject) => ({ version, reason, includeContent, priority, subject })));
    const latestContentOwner = new Map<string, string>();
    for (const descriptor of descriptors) {
      if (descriptor.includeContent) latestContentOwner.set(descriptor.subject.path, descriptor.version.versionId);
    }
    const eligible = descriptors
      .filter(({ version, subject, includeContent }) => includeContent
        && /\.(?:md|ya?ml|json)$/iu.test(subject.path)
        && latestContentOwner.get(subject.path) === version.versionId)
      .sort((left, right) => right.priority - left.priority);
    let clipped = false;
    const items: ContextItem[] = descriptors.map(({ version, reason, subject }) => {
      return {
        versionId: version.versionId,
        kind: version.kind,
        scopeId: version.scope.id,
        path: subject.path,
        sha256: subject.sha256,
        includedReason: reason,
        contentMode: "METADATA_ONLY",
        clipped: false,
      };
    });
    const result: { workflow: ContextWorkflow; moduleId?: string; items: ContextItem[]; clipped: boolean } = {
      workflow,
      ...(module ? { moduleId: module.moduleId } : {}),
      items,
      clipped,
    };
    if (utf8Size(result) > maxTotalCharacters) {
      throw new Error("最小上下文版本索引已经超过预算，请进一步拆分业务模块或减少输入版本");
    }
    for (const { version, subject } of eligible) {
      const item = items.find((candidate) => candidate.versionId === version.versionId
        && candidate.path === subject.path);
      if (!item) continue;
      const content = await readFile(
        await resolveStoredSnapshotPath(this.store.workspaceRoot, subject.snapshotPath),
        "utf8",
      );
      const remainingBytes = maxTotalCharacters - utf8Size(result);
      if (remainingBytes <= 16) break;
      const excerpt = utf8Prefix(content, Math.min(6_000, remainingBytes - 16));
      if (!excerpt) break;
      item.content = excerpt;
      item.clipped = excerpt.length < content.length;
      item.contentMode = item.clipped ? "TRUNCATED" : "FULL";
      result.clipped = result.items.some((candidate) => candidate.clipped);
      while (utf8Size(result) > maxTotalCharacters && item.content) {
        item.content = utf8Prefix(item.content, Math.max(0, Buffer.byteLength(item.content, "utf8") - 128));
        item.clipped = true;
      }
    }
    return result;
  }
}

function utf8Size(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function utf8Prefix(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  let result = "";
  let size = 0;
  for (const character of value) {
    const characterSize = Buffer.byteLength(character, "utf8");
    if (size + characterSize > maxBytes) break;
    result += character;
    size += characterSize;
  }
  return result;
}
