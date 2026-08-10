import path from "node:path";

import type {
  ArtifactKind,
  ArtifactScope,
  ArtifactSubject,
  ApprovedVersion,
  CandidateFacts,
  DeterministicCheck,
  ModuleDesignFacts,
  RequirementMapFacts,
} from "./domain.js";
import { validateRequirementMap } from "./requirement-map.js";

export class ArtifactValidationError extends Error {
  constructor(readonly checks: DeterministicCheck[]) {
    super(checks.filter((check) => check.status === "FAILED").map((check) => check.detail).join("; "));
  }
}

type ValidationInput = {
  kind: ArtifactKind;
  scope: ArtifactScope;
  subjects: ArtifactSubject[];
  textByPath: Map<string, string>;
  facts?: CandidateFacts;
  approvedVersions: ApprovedVersion[];
};

const LEGACY_TERMS = /\b(?:CapabilityUnit|ExecutionPlan|cuId|cuName)\b|能力单元/u;
const REQUIRED_SECTIONS: Partial<Record<ArtifactKind, string[]>> = {
  PRODUCT_BRIEF: ["产品目标", "系统边界", "主要角色", "业务模块", "未知"],
  REQUIREMENT_MAP: ["业务模块", "功能组", "执行依赖", "外部接口", "非功能需求"],
  MODULE_REQUIREMENT: [
    "模块目标", "范围", "角色", "功能组", "需求条目", "异常", "依赖模块", "外部接口", "非功能需求", "验证", "来源", "修订",
  ],
  INTERFACE_REQUIREMENT: ["业务用途", "输入", "输出", "错误", "认证", "超时", "数据", "业务模块", "验证", "来源"],
  QUALITY_REQUIREMENT: ["稳定编号", "作用范围", "目标", "验证方法", "来源"],
  PRODUCT_ARCHITECTURE: ["系统边界", "模块关系", "运行", "数据", "认证", "部署", "失败", "系统测试", "设计决定"],
  MODULE_DESIGN: ["输入版本", "模块目标", "范围", "接口", "数据", "状态", "错误", "权限", "实现路径", "追溯", "风险", "修订"],
  INTERFACE_DESIGN: ["输入版本", "协议", "地址", "请求", "响应", "认证", "超时", "错误码", "演进", "契约测试"],
};

export function validateArtifact(input: ValidationInput): DeterministicCheck[] {
  const checks: DeterministicCheck[] = [];
  const fail = (check: string, detail: string) => checks.push({ check, status: "FAILED" as const, detail });
  const pass = (check: string, detail: string) => checks.push({ check, status: "PASSED" as const, detail });

  validatePaths(input, fail);
  for (const [subjectPath, text] of input.textByPath) {
    if (LEGACY_TERMS.test(text)) fail("legacy-terms", `${subjectPath} 仍包含已废弃的能力单元或执行计划概念`);
  }
  if (!checks.some((check) => check.check === "legacy-terms" && check.status === "FAILED")) {
    pass("legacy-terms", "未发现已废弃的能力单元或执行计划概念");
  }

  const requiredSections = REQUIRED_SECTIONS[input.kind] ?? [];
  if (requiredSections.length > 0) {
    const combined = [...input.textByPath.values()].join("\n");
    const missing = requiredSections.filter((section) => !new RegExp(`^#{1,6}\\s+.*${escapeRegex(section)}`, "mu").test(combined));
    if (missing.length > 0) fail("required-sections", `缺少必要章节: ${missing.join("、")}`);
    else pass("required-sections", `已包含 ${requiredSections.length} 个必要章节`);
  }

  if (input.kind === "REQUIREMENT_MAP") {
    if (!isRequirementMapFacts(input.facts)) fail("requirement-map-facts", "需求地图候选缺少结构化业务模块事实");
    else checks.push(...validateRequirementMap(input.facts));
  }

  if (input.kind === "MODULE_DESIGN") {
    if (!isModuleDesignFacts(input.facts)) {
      fail("module-path-boundary", "模块设计候选缺少产品代码和测试代码路径边界");
    } else {
      const allPaths = [...input.facts.productPaths, ...input.facts.testPaths];
      if (allPaths.length === 0 || allPaths.some((candidate) => !isSafeRelativePath(candidate))) {
        fail("module-path-boundary", "模块实现路径必须是工作区内的相对路径");
      } else {
        pass("module-path-boundary", "模块产品路径和测试路径边界有效");
      }
    }
  }

  if (checks.some((check) => check.status === "FAILED")) throw new ArtifactValidationError(checks);
  return checks;
}

function validatePaths(
  input: ValidationInput,
  fail: (check: string, detail: string) => void,
): void {
  const paths = new Set(input.subjects.map((subject) => toPortable(subject.path)));
  const has = (candidate: string) => paths.has(candidate);
  const requirePath = (candidate: string) => {
    if (!has(candidate)) fail("artifact-path", `${input.kind} 缺少规定文件: ${candidate}`);
  };

  switch (input.kind) {
    case "PRODUCT_BRIEF": requirePath("docs/requirements/product-brief.md"); break;
    case "REQUIREMENT_MAP": requirePath("docs/requirements/requirement-map.md"); break;
    case "REQUIREMENT_SET": requirePath("docs/requirements/requirement-set.yaml"); break;
    case "PRODUCT_ARCHITECTURE": requirePath("docs/design/product-architecture.md"); break;
    case "DESIGN_SET": requirePath("docs/design/design-set.yaml"); break;
    case "SYSTEM_TEST": requirePath("docs/verification/verification-report.md"); break;
    case "SYSTEM_ACCEPTANCE": requirePath("docs/verification/verification-report.md"); break;
    case "MODULE_REQUIREMENT": {
      const module = findModule(input.approvedVersions, input.scope.id);
      if (module) requirePath(`docs/requirements/modules/${module.slug}/functional-requirements.md`);
      break;
    }
    case "INTERFACE_REQUIREMENT": {
      const contract = findRequirementMap(input.approvedVersions)?.interfaces.find((item) => item.interfaceId === input.scope.id);
      if (contract) requirePath(`docs/requirements/interfaces/${contract.slug}.md`);
      break;
    }
    case "QUALITY_REQUIREMENT": {
      const quality = findRequirementMap(input.approvedVersions)?.qualityRequirements.find((item) => item.qualityId === input.scope.id);
      if (quality) requirePath(`docs/requirements/quality/${quality.scope === "GLOBAL" ? "global" : quality.slug}.md`);
      break;
    }
    case "MODULE_DESIGN": {
      const module = findModule(input.approvedVersions, input.scope.id);
      if (module) {
        requirePath(`docs/design/modules/${module.slug}/design.md`);
        requirePath(`docs/verification/modules/${module.slug}/verification-spec.md`);
      }
      break;
    }
    case "INTERFACE_DESIGN": {
      const contract = findRequirementMap(input.approvedVersions)?.interfaces.find((item) => item.interfaceId === input.scope.id);
      if (contract) requirePath(`docs/design/interfaces/${contract.slug}.md`);
      break;
    }
    default: break;
  }
}

export function findRequirementMap(versions: ApprovedVersion[]): RequirementMapFacts | undefined {
  const current = versions
    .filter((version) => version.kind === "REQUIREMENT_MAP" && version.scope.id === "project")
    .sort((left, right) => right.revision - left.revision)[0];
  return isRequirementMapFacts(current?.facts) ? current.facts : undefined;
}

export function findModule(versions: ApprovedVersion[], moduleId: string) {
  return findRequirementMap(versions)?.businessModules.find((module) => module.moduleId === moduleId);
}

export function isRequirementMapFacts(value: CandidateFacts | undefined): value is RequirementMapFacts {
  return Boolean(value && "businessModules" in value && "interfaces" in value && "qualityRequirements" in value);
}

export function isModuleDesignFacts(value: CandidateFacts | undefined): value is ModuleDesignFacts {
  return Boolean(value && "productPaths" in value && "testPaths" in value);
}

function isSafeRelativePath(candidate: string): boolean {
  if (!candidate.trim() || path.isAbsolute(candidate)) return false;
  const normalized = path.normalize(candidate);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function toPortable(value: string): string {
  return value.replaceAll("\\", "/");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
