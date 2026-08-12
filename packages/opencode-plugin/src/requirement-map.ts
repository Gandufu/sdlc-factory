import type {
  BusinessModule,
  DeterministicCheck,
  RequirementMapFacts,
} from "./domain.js";

const STABLE_ID = /^[a-z][a-z0-9-]{1,63}$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export class RequirementMapError extends Error {
  constructor(readonly checks: DeterministicCheck[]) {
    super(checks.filter((check) => check.status === "FAILED").map((check) => check.detail).join("; "));
  }
}

export function validateRequirementMap(facts: RequirementMapFacts): DeterministicCheck[] {
  const checks: DeterministicCheck[] = [];
  const fail = (check: string, detail: string) => checks.push({ check, status: "FAILED" as const, detail });
  const pass = (check: string, detail: string) => checks.push({ check, status: "PASSED" as const, detail });

  if (facts.businessModules.length === 0) {
    fail("business-modules", "需求地图至少需要一个业务模块");
  } else {
    pass("business-modules", `已定义 ${facts.businessModules.length} 个业务模块`);
  }

  const moduleIds = new Set<string>();
  const moduleNames = new Set<string>();
  const moduleSlugs = new Set<string>();
  for (const module of facts.businessModules) {
    validateIdentity("业务模块", module.moduleId, module.name, module.slug, moduleIds, moduleNames, moduleSlugs, fail);
    if (!module.goal.trim()) fail("module-goal", `业务模块 ${module.name} 缺少业务目标`);
    if (module.functionalGroups.length === 0) {
      fail("functional-groups", `业务模块 ${module.name} 至少需要一个功能组`);
    }
    if (new Set(module.functionalGroups.map((group) => group.trim())).size !== module.functionalGroups.length) {
      fail("functional-groups", `业务模块 ${module.name} 存在空白或重复功能组`);
    }
  }

  for (const module of facts.businessModules) {
    for (const dependency of module.dependencies) {
      if (!moduleIds.has(dependency) || dependency === module.moduleId) {
        fail("module-dependencies", `业务模块 ${module.name} 的执行依赖无效: ${dependency}`);
      }
    }
  }
  const cycle = findDependencyCycle(facts.businessModules);
  if (cycle) fail("module-dependencies", `业务模块执行依赖存在循环: ${cycle.join(" -> ")}`);
  else pass("module-dependencies", "业务模块执行依赖有效且无循环");

  const interfaceIds = new Set<string>();
  const interfaceNames = new Set<string>();
  const interfaceSlugs = new Set<string>();
  for (const contract of facts.interfaces) {
    validateIdentity(
      "外部接口",
      contract.interfaceId,
      contract.name,
      contract.slug,
      interfaceIds,
      interfaceNames,
      interfaceSlugs,
      fail,
    );
    if (contract.scopeModuleIds.length === 0) fail("interface-scope", `外部接口 ${contract.name} 缺少作用模块`);
    for (const moduleId of contract.scopeModuleIds) {
      if (!moduleIds.has(moduleId)) fail("interface-scope", `外部接口 ${contract.name} 引用了不存在的模块: ${moduleId}`);
    }
  }
  for (const module of facts.businessModules) {
    for (const interfaceId of module.interfaceIds) {
      const contract = facts.interfaces.find((item) => item.interfaceId === interfaceId);
      if (!contract || !contract.scopeModuleIds.includes(module.moduleId)) {
        fail("interface-references", `业务模块 ${module.name} 的外部接口引用不一致: ${interfaceId}`);
      }
    }
  }

  const qualityIds = new Set<string>();
  const qualityNames = new Set<string>();
  const qualitySlugs = new Set<string>();
  const globalQualityRequirements = facts.qualityRequirements.filter((quality) => quality.scope === "GLOBAL");
  if (globalQualityRequirements.length > 1) {
    fail("quality-global", "全局非功能需求必须合并为需求地图中的一个对象和一份 global.md，分类使用文档内稳定编号表达");
  }
  for (const quality of facts.qualityRequirements) {
    validateIdentity(
      "非功能需求",
      quality.qualityId,
      quality.name,
      quality.slug,
      qualityIds,
      qualityNames,
      qualitySlugs,
      fail,
    );
    if (quality.scope === "MODULES" && quality.scopeModuleIds.length === 0) {
      fail("quality-scope", `模块级非功能需求 ${quality.name} 缺少作用模块`);
    }
    if (quality.scope === "GLOBAL" && quality.scopeModuleIds.length > 0) {
      fail("quality-scope", `全局非功能需求 ${quality.name} 不应重复声明模块范围`);
    }
    for (const moduleId of quality.scopeModuleIds) {
      if (!moduleIds.has(moduleId)) fail("quality-scope", `非功能需求 ${quality.name} 引用了不存在的模块: ${moduleId}`);
    }
  }
  for (const module of facts.businessModules) {
    for (const qualityId of module.qualityIds) {
      const quality = facts.qualityRequirements.find((item) => item.qualityId === qualityId);
      if (!quality || (quality.scope === "MODULES" && !quality.scopeModuleIds.includes(module.moduleId))) {
        fail("quality-references", `业务模块 ${module.name} 的非功能需求引用不一致: ${qualityId}`);
      }
    }
  }

  if (checks.some((check) => check.status === "FAILED")) throw new RequirementMapError(checks);
  return checks;
}

export function affectedBusinessModules(
  modules: BusinessModule[],
  changedModuleIds: string[],
): string[] {
  const affected = new Set(changedModuleIds);
  let found = true;
  while (found) {
    found = false;
    for (const module of modules) {
      if (!affected.has(module.moduleId) && module.dependencies.some((dependency) => affected.has(dependency))) {
        affected.add(module.moduleId);
        found = true;
      }
    }
  }
  return modules.filter((module) => affected.has(module.moduleId)).map((module) => module.moduleId);
}

function validateIdentity(
  label: string,
  id: string,
  name: string,
  slug: string,
  ids: Set<string>,
  names: Set<string>,
  slugs: Set<string>,
  fail: (check: string, detail: string) => void,
): void {
  if (!STABLE_ID.test(id) || ids.has(id)) fail("stable-identity", `${label}编号无效或重复: ${id}`);
  if (!name.trim() || names.has(name.trim())) fail("stable-identity", `${label}名称为空或重复: ${name}`);
  if (!SLUG.test(slug) || slugs.has(slug)) fail("stable-identity", `${label}路径名无效或重复: ${slug}`);
  ids.add(id);
  names.add(name.trim());
  slugs.add(slug);
}

function findDependencyCycle(modules: BusinessModule[]): string[] | undefined {
  const byId = new Map(modules.map((module) => [module.moduleId, module]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (moduleId: string): string[] | undefined => {
    if (visiting.has(moduleId)) return [...path.slice(path.indexOf(moduleId)), moduleId];
    if (visited.has(moduleId) || !byId.has(moduleId)) return undefined;
    visiting.add(moduleId);
    path.push(moduleId);
    for (const dependency of byId.get(moduleId)!.dependencies) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(moduleId);
    visited.add(moduleId);
    return undefined;
  };
  for (const module of modules) {
    const cycle = visit(module.moduleId);
    if (cycle) return cycle;
  }
  return undefined;
}
