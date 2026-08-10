import { readFile } from "node:fs/promises";

import { currentVersion } from "./candidate-service.js";
import { findRequirementMap } from "./artifact-validator.js";
import type { ApprovedVersion } from "./domain.js";
import type { ProjectStore } from "./project-store.js";

type ContextWorkflow = "SPEC" | "DESIGN" | "CODE" | "MODULE_TEST" | "SYSTEM_TEST";

export type ContextItem = {
  versionId: string;
  kind: string;
  scopeId: string;
  path: string;
  sha256: string;
  includedReason: string;
  content?: string;
  clipped: boolean;
};

export class ContextService {
  constructor(private readonly store: ProjectStore) {}

  async assemble(
    workflow: ContextWorkflow,
    moduleName: string | undefined,
    maxTotalCharacters: number,
  ): Promise<{ workflow: ContextWorkflow; moduleId?: string; items: ContextItem[]; clipped: boolean }> {
    if (maxTotalCharacters < 4_000 || maxTotalCharacters > 60_000) {
      throw new Error("最小上下文字符上限必须在 4000 到 60000 之间");
    }
    const versions = await this.store.listJson<ApprovedVersion>("approved-versions");
    const map = findRequirementMap(versions);
    const module = moduleName ? map?.businessModules.find((item) => item.name === moduleName) : undefined;
    if (moduleName && !module) throw new Error(`业务模块名称不存在: ${moduleName}`);
    const selected = new Map<string, { version: ApprovedVersion; reason: string }>();
    const add = (version: ApprovedVersion | undefined, reason: string) => {
      if (version) selected.set(version.versionId, { version, reason });
    };
    add(currentVersion(versions, "PRODUCT_BRIEF", "project"), "产品公共边界");
    add(currentVersion(versions, "REQUIREMENT_MAP", "project"), "目标模块和直接关系");

    if (workflow !== "SPEC") add(currentVersion(versions, "REQUIREMENT_SET", "project"), "精确总需求输入");
    if (["CODE", "MODULE_TEST", "SYSTEM_TEST"].includes(workflow)) {
      add(currentVersion(versions, "DESIGN_SET", "project"), "精确总设计输入");
    }
    if (["DESIGN", "CODE", "MODULE_TEST", "SYSTEM_TEST"].includes(workflow)) {
      add(currentVersion(versions, "PRODUCT_ARCHITECTURE", "project"), "跨模块设计约束");
    }

    if (module && map) {
      add(currentVersion(versions, "MODULE_REQUIREMENT", module.moduleId), "当前业务模块需求");
      if (workflow !== "SPEC") add(currentVersion(versions, "MODULE_DESIGN", module.moduleId), "当前业务模块设计和测试说明");
      if (["CODE", "MODULE_TEST"].includes(workflow)) add(currentVersion(versions, "CODE", module.moduleId), "当前业务模块代码版本清单");
      for (const interfaceId of module.interfaceIds) {
        add(currentVersion(versions, "INTERFACE_REQUIREMENT", interfaceId), "当前模块引用的外部接口需求");
        if (workflow !== "SPEC") add(currentVersion(versions, "INTERFACE_DESIGN", interfaceId), "当前模块引用的接口设计");
      }
      for (const quality of map.qualityRequirements.filter((item) => item.scope === "GLOBAL" || item.scopeModuleIds.includes(module.moduleId))) {
        add(currentVersion(versions, "QUALITY_REQUIREMENT", quality.qualityId), "当前模块适用的非功能需求");
      }
      for (const dependencyId of module.dependencies) {
        add(currentVersion(versions, "MODULE_REQUIREMENT", dependencyId), "直接依赖模块需求");
        if (["CODE", "MODULE_TEST"].includes(workflow)) add(currentVersion(versions, "CODE", dependencyId), "直接依赖模块代码版本清单");
      }
    }

    if (workflow === "SYSTEM_TEST" && map) {
      for (const businessModule of map.businessModules.filter((item) => item.status === "ACTIVE")) {
        add(currentVersion(versions, "CODE", businessModule.moduleId), "系统测试参与模块代码版本清单");
        add(currentVersion(versions, "MODULE_TEST", businessModule.moduleId), "系统测试参与模块测试结果");
      }
    }

    const items: ContextItem[] = [];
    let remaining = maxTotalCharacters;
    let clipped = false;
    for (const { version, reason } of selected.values()) {
      for (const subject of version.subjects) {
        const textual = /\.(?:md|ya?ml|json)$/iu.test(subject.path);
        let content: string | undefined;
        let itemClipped = false;
        if (textual && remaining > 0) {
          const text = await readFile(subject.snapshotPath, "utf8");
          const allowance = Math.min(12_000, remaining);
          content = text.slice(0, allowance);
          itemClipped = content.length < text.length;
          remaining -= content.length;
        } else if (textual) {
          itemClipped = true;
        }
        clipped ||= itemClipped;
        items.push({
          versionId: version.versionId,
          kind: version.kind,
          scopeId: version.scope.id,
          path: subject.path,
          sha256: subject.sha256,
          includedReason: reason,
          ...(content !== undefined ? { content } : {}),
          clipped: itemClipped,
        });
      }
    }
    return {
      workflow,
      ...(module ? { moduleId: module.moduleId } : {}),
      items,
      clipped,
    };
  }
}
