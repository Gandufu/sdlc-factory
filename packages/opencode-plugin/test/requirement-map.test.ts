import { describe, expect, it } from "vitest";

import { affectedBusinessModules, RequirementMapError, validateRequirementMap } from "../src/requirement-map.js";
import { requirementMapFacts } from "./fixtures.js";

describe("需求地图", () => {
  it("校验业务模块、功能组、接口、质量范围和依赖", () => {
    expect(validateRequirementMap(requirementMapFacts).every((check) => check.status === "PASSED")).toBe(true);
  });

  it("拒绝循环执行依赖", () => {
    const cyclic = structuredClone(requirementMapFacts);
    cyclic.businessModules.push({
      moduleId: "module-audit",
      name: "审计管理",
      slug: "audit",
      goal: "审计系统操作",
      functionalGroups: ["审计查询"],
      dependencies: ["module-system-management"],
      interfaceIds: [],
      qualityIds: ["quality-security"],
      status: "ACTIVE",
    });
    cyclic.businessModules[0]!.dependencies = ["module-audit"];

    expect(() => validateRequirementMap(cyclic)).toThrow(RequirementMapError);
  });

  it("按业务模块依赖传播变化影响", () => {
    const modules = [
      { ...requirementMapFacts.businessModules[0]!, dependencies: [] },
      {
        ...requirementMapFacts.businessModules[0]!,
        moduleId: "module-audit",
        name: "审计管理",
        slug: "audit",
        dependencies: ["module-system-management"],
      },
    ];
    expect(affectedBusinessModules(modules, ["module-system-management"]))
      .toEqual(["module-system-management", "module-audit"]);
  });
});
