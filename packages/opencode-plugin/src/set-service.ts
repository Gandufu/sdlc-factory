import { currentVersion, type CreateCandidateInput, CandidateService } from "./candidate-service.js";
import { findRequirementMap } from "./artifact-validator.js";
import type {
  ApprovedVersion,
  Candidate,
  ChangeType,
  RequirementMapFacts,
} from "./domain.js";
import { writeLifecycleDocument } from "./document-service.js";
import type { ProjectStore } from "./project-store.js";

type RuntimeValues = { id(): string; now(): string };

type CreateSetInput = {
  kind: "REQUIREMENT_SET" | "DESIGN_SET";
  changeType: ChangeType;
  changeSummary: string;
  proposedImpactScopeIds: string[];
  sessionId: string;
};

export class SetService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly runtime: RuntimeValues,
  ) {}

  async create(input: CreateSetInput): Promise<Candidate> {
    const versions = await this.store.listJson<ApprovedVersion>("approved-versions");
    const map = findRequirementMap(versions);
    if (!map) throw new Error("创建版本集合前必须先批准需求地图");
    const components = input.kind === "REQUIREMENT_SET"
      ? requirementComponents(versions, map)
      : designComponents(versions, map);
    validateComponentInputs(input.kind, components, versions, map);

    const current = currentVersion(versions, input.kind, "project");
    const targetPath = input.kind === "REQUIREMENT_SET"
      ? "docs/requirements/requirement-set.yaml"
      : "docs/design/design-set.yaml";
    const yaml = serializeSet(input.kind, components, current?.versionId);
    await writeLifecycleDocument(this.workspaceRoot, targetPath, yaml);
    const candidateInput: CreateCandidateInput = {
      kind: input.kind,
      scope: { type: "PROJECT", id: "project", name: "项目" },
      subjectPaths: [targetPath],
      ...(current ? { parentVersionId: current.versionId } : {}),
      inputVersionIds: components.map((version) => version.versionId),
      sourceIds: [],
      testRecordIds: [],
      changeType: input.changeType,
      changeSummary: input.changeSummary,
      proposedImpactScopeIds: input.proposedImpactScopeIds,
      facts: { componentVersionIds: components.map((version) => version.versionId) },
      createdBySessionId: input.sessionId,
    };
    return new CandidateService(this.store, this.workspaceRoot, this.runtime).createFromSetService(candidateInput);
  }
}

function requirementComponents(versions: ApprovedVersion[], map: RequirementMapFacts): ApprovedVersion[] {
  const required: Array<readonly [ApprovedVersion["kind"], string]> = [
    ["PRODUCT_BRIEF", "project"],
    ["REQUIREMENT_MAP", "project"],
    ...map.businessModules.filter((module) => module.status === "ACTIVE")
      .map((module) => ["MODULE_REQUIREMENT", module.moduleId] as const),
    ...map.interfaces.map((contract) => ["INTERFACE_REQUIREMENT", contract.interfaceId] as const),
    ...map.qualityRequirements.map((quality) => ["QUALITY_REQUIREMENT", quality.qualityId] as const),
  ];
  return required.map(([kind, scopeId]) => requiredCurrent(versions, kind, scopeId));
}

function designComponents(versions: ApprovedVersion[], map: RequirementMapFacts): ApprovedVersion[] {
  const required: Array<readonly [ApprovedVersion["kind"], string]> = [
    ["REQUIREMENT_SET", "project"],
    ["PRODUCT_ARCHITECTURE", "project"],
    ...map.businessModules.filter((module) => module.status === "ACTIVE")
      .map((module) => ["MODULE_DESIGN", module.moduleId] as const),
    ...map.interfaces.map((contract) => ["INTERFACE_DESIGN", contract.interfaceId] as const),
  ];
  return required.map(([kind, scopeId]) => requiredCurrent(versions, kind, scopeId));
}

function requiredCurrent(
  versions: ApprovedVersion[],
  kind: ApprovedVersion["kind"],
  scopeId: string,
): ApprovedVersion {
  const version = currentVersion(versions, kind, scopeId);
  if (!version) throw new Error(`缺少已批准组件: ${kind}/${scopeId}`);
  return version;
}

function validateComponentInputs(
  kind: "REQUIREMENT_SET" | "DESIGN_SET",
  components: ApprovedVersion[],
  versions: ApprovedVersion[],
  map: RequirementMapFacts,
): void {
  const mapVersion = currentVersion(versions, "REQUIREMENT_MAP", "project")!;
  if (kind === "REQUIREMENT_SET") {
    for (const component of components.filter((item) => [
      "MODULE_REQUIREMENT", "INTERFACE_REQUIREMENT", "QUALITY_REQUIREMENT",
    ].includes(item.kind))) {
      if (!component.inputVersionIds.includes(mapVersion.versionId)) {
        throw new Error(`需求组件 ${component.versionId} 没有绑定当前需求地图: ${mapVersion.versionId}`);
      }
    }
    return;
  }
  const requirementSet = currentVersion(versions, "REQUIREMENT_SET", "project")!;
  const architecture = components.find((component) => component.kind === "PRODUCT_ARCHITECTURE")!;
  if (!architecture.inputVersionIds.includes(requirementSet.versionId)) {
    throw new Error(`产品总体设计 ${architecture.versionId} 没有绑定当前总需求版本: ${requirementSet.versionId}`);
  }
  for (const module of map.businessModules.filter((item) => item.status === "ACTIVE")) {
    const design = components.find((component) => component.kind === "MODULE_DESIGN" && component.scope.id === module.moduleId)!;
    const requirement = currentVersion(versions, "MODULE_REQUIREMENT", module.moduleId)!;
    for (const required of [requirementSet.versionId, requirement.versionId]) {
      if (!design.inputVersionIds.includes(required)) {
        throw new Error(`模块设计 ${design.versionId} 没有绑定当前输入版本: ${required}`);
      }
    }
  }
  for (const contract of map.interfaces) {
    const design = components.find((component) => component.kind === "INTERFACE_DESIGN" && component.scope.id === contract.interfaceId)!;
    const requirement = currentVersion(versions, "INTERFACE_REQUIREMENT", contract.interfaceId)!;
    for (const required of [requirementSet.versionId, requirement.versionId]) {
      if (!design.inputVersionIds.includes(required)) {
        throw new Error(`接口设计 ${design.versionId} 没有绑定当前输入版本: ${required}`);
      }
    }
  }
}

function serializeSet(
  kind: "REQUIREMENT_SET" | "DESIGN_SET",
  components: ApprovedVersion[],
  parentVersionId: string | undefined,
): string {
  const lines = [
    "schemaVersion: 1",
    `kind: ${kind}`,
    ...(parentVersionId ? [`parentVersionId: ${JSON.stringify(parentVersionId)}`] : []),
    "components:",
  ];
  for (const component of components.sort((left, right) => left.versionId.localeCompare(right.versionId))) {
    lines.push(
      `  - versionId: ${JSON.stringify(component.versionId)}`,
      `    kind: ${component.kind}`,
      `    scopeId: ${JSON.stringify(component.scope.id)}`,
      `    contentHash: ${component.contentHash}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
