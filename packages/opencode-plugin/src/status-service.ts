import { currentVersion } from "./candidate-service.js";
import { findRequirementMap } from "./artifact-validator.js";
import type {
  ApprovedVersion,
  ArtifactKind,
  BusinessModule,
  Candidate,
  EnvironmentVersion,
  JournalEvent,
  ReviewRecord,
  RunRecord,
  TestRecord,
  VersionSetFacts,
} from "./domain.js";
import type { ProjectStore } from "./project-store.js";

export type RecommendedAction = {
  action: string;
  todo: string;
  command: string;
  reason: string;
};

export type ModuleProgress = {
  moduleId: string;
  moduleName: string;
  stage: "REQUIREMENTS" | "DESIGN" | "CODING" | "MODULE_TEST" | "SYSTEM_TEST" | "COMPLETED";
  state: "NOT_STARTED" | "IN_PROGRESS" | "WAITING_REVIEW" | "SUSPENDED" | "BLOCKED" | "COMPLETED" | "INVALIDATED";
  requirementVersionId?: string;
  designVersionId?: string;
  codeVersionId?: string;
  moduleTestVersionId?: string;
  systemTestVersionId?: string;
  unitTestResult?: string;
  moduleTestResult?: string;
  systemTestResult?: string;
  blockers: string[];
  recommendedCommand?: string;
};

export type ProjectStatus = {
  initialized: true;
  projectName: string;
  lifecyclePhase: string;
  requirementMapVersionId?: string;
  requirementSetVersionId?: string;
  designSetVersionId?: string;
  systemTestVersionId?: string;
  systemAcceptanceVersionId?: string;
  registeredSources: Array<{ sourceId: string; sha256: string }>;
  pendingCandidates: Array<{
    candidateId: string;
    kind: ArtifactKind;
    scopeId: string;
    scopeName: string;
    contentHash: string;
    reviewState: "PENDING" | "HOLD";
  }>;
  environments: Array<{ environmentVersionId: string; environmentId: string; name: string; contentHash: string }>;
  gates: string[];
  projectProgressAvailable: boolean;
  modules?: ModuleProgress[];
  recommendedAction: RecommendedAction;
};

type Manifest = { projectName: string };

export class StatusService {
  constructor(private readonly store: ProjectStore) {}

  async read(): Promise<ProjectStatus> {
    const [manifest, sources, candidates, reviews, versions, runs, testRecords, environments, events] = await Promise.all([
      this.store.readManifest<Manifest>(),
      this.store.listJson<{ sourceId: string; sha256: string }>("sources"),
      this.store.listJson<Candidate>("candidates"),
      this.store.listJson<ReviewRecord>("reviews"),
      this.store.listJson<ApprovedVersion>("approved-versions"),
      this.store.listJson<RunRecord>("runs"),
      this.store.listJson<TestRecord>("test-runs"),
      this.store.listJson<EnvironmentVersion>("environments"),
      this.store.readJournal<JournalEvent>(),
    ]);
    const pendingCandidates = pending(candidates, reviews);
    const mapVersion = currentVersion(versions, "REQUIREMENT_MAP", "project");
    const map = findRequirementMap(versions);
    const requirementSet = validRequirementSet(versions, map);
    const designSet = validDesignSet(versions, map, requirementSet);
    const systemTest = validSystemTest(versions, map, designSet, testRecords);
    const systemAcceptance = validAcceptance(versions, systemTest);
    const gates: string[] = [];
    if (!currentVersion(versions, "PRODUCT_BRIEF", "project")) gates.push("产品概述尚未批准");
    if (!mapVersion) gates.push("需求地图尚未批准");
    if (map && !requirementSet) gates.push("总需求版本尚未批准或已失效");
    if (requirementSet && !designSet) gates.push("总设计版本尚未批准或已失效");

    const modules = designSet && map && requirementSet
      ? map.businessModules.filter((module) => module.status === "ACTIVE").map((module) => moduleProgress({
        module,
        versions,
        requirementSet,
        designSet,
        systemTest,
        systemAcceptance,
        pendingCandidates,
        runs,
        events,
        testRecords,
      }))
      : undefined;
    const recommendedAction = recommend({
      pendingCandidates,
      versions,
      map,
      requirementSet,
      designSet,
      modules,
      systemTest,
      systemAcceptance,
    });
    return {
      initialized: true,
      projectName: manifest.projectName,
      lifecyclePhase: lifecyclePhase(mapVersion, requirementSet, designSet, systemTest, systemAcceptance),
      ...(mapVersion ? { requirementMapVersionId: mapVersion.versionId } : {}),
      ...(requirementSet ? { requirementSetVersionId: requirementSet.versionId } : {}),
      ...(designSet ? { designSetVersionId: designSet.versionId } : {}),
      ...(systemTest ? { systemTestVersionId: systemTest.versionId } : {}),
      ...(systemAcceptance ? { systemAcceptanceVersionId: systemAcceptance.versionId } : {}),
      registeredSources: sources.map(({ sourceId, sha256 }) => ({ sourceId, sha256 })),
      pendingCandidates,
      environments: currentEnvironments(environments),
      gates,
      projectProgressAvailable: Boolean(designSet),
      ...(modules ? { modules } : {}),
      recommendedAction,
    };
  }
}

export function findModuleByExactName(status: ProjectStatus, moduleName: string): ModuleProgress {
  const module = status.modules?.find((candidate) => candidate.moduleName === moduleName);
  if (!module) throw new Error(`业务模块名称不在当前项目进度中或总设计尚未批准: ${moduleName}`);
  return module;
}

function pending(candidates: Candidate[], reviews: ReviewRecord[]): ProjectStatus["pendingCandidates"] {
  return candidates.flatMap((candidate) => {
    const candidateReviews = reviews
      .filter((review) => review.candidateId === candidate.candidateId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    if (candidateReviews.some((review) => review.decision === "APPROVE" || review.decision === "REVISE")) return [];
    return [{
      candidateId: candidate.candidateId,
      kind: candidate.kind,
      scopeId: candidate.scope.id,
      scopeName: candidate.scope.name,
      contentHash: candidate.contentHash,
      reviewState: candidateReviews[0]?.decision === "HOLD" ? "HOLD" as const : "PENDING" as const,
    }];
  }).sort((left, right) => left.candidateId.localeCompare(right.candidateId));
}

function validRequirementSet(
  versions: ApprovedVersion[],
  map: ReturnType<typeof findRequirementMap>,
): ApprovedVersion | undefined {
  if (!map) return undefined;
  const set = currentVersion(versions, "REQUIREMENT_SET", "project");
  if (!set || !isSetFacts(set.facts)) return undefined;
  const mapVersion = currentVersion(versions, "REQUIREMENT_MAP", "project")!;
  const required = [
    currentVersion(versions, "PRODUCT_BRIEF", "project"),
    currentVersion(versions, "REQUIREMENT_MAP", "project"),
    ...map.businessModules.filter((module) => module.status === "ACTIVE")
      .map((module) => currentVersion(versions, "MODULE_REQUIREMENT", module.moduleId)),
    ...map.interfaces.map((contract) => currentVersion(versions, "INTERFACE_REQUIREMENT", contract.interfaceId)),
    ...map.qualityRequirements.map((quality) => currentVersion(versions, "QUALITY_REQUIREMENT", quality.qualityId)),
  ];
  if (required.some((version) => !version)) return undefined;
  for (const version of required.filter((item) => item && [
    "MODULE_REQUIREMENT", "INTERFACE_REQUIREMENT", "QUALITY_REQUIREMENT",
  ].includes(item.kind))) {
    if (!version!.inputVersionIds.includes(mapVersion.versionId)) return undefined;
  }
  return sameSet(set.facts.componentVersionIds, required.map((version) => version!.versionId)) ? set : undefined;
}

function validDesignSet(
  versions: ApprovedVersion[],
  map: ReturnType<typeof findRequirementMap>,
  requirementSet: ApprovedVersion | undefined,
): ApprovedVersion | undefined {
  if (!map || !requirementSet) return undefined;
  const set = currentVersion(versions, "DESIGN_SET", "project");
  if (!set || !isSetFacts(set.facts)) return undefined;
  const required = [
    requirementSet,
    currentVersion(versions, "PRODUCT_ARCHITECTURE", "project"),
    ...map.businessModules.filter((module) => module.status === "ACTIVE")
      .map((module) => currentVersion(versions, "MODULE_DESIGN", module.moduleId)),
    ...map.interfaces.map((contract) => currentVersion(versions, "INTERFACE_DESIGN", contract.interfaceId)),
  ];
  if (required.some((version) => !version)) return undefined;
  const architecture = currentVersion(versions, "PRODUCT_ARCHITECTURE", "project")!;
  if (!architecture.inputVersionIds.includes(requirementSet.versionId)) return undefined;
  for (const module of map.businessModules.filter((item) => item.status === "ACTIVE")) {
    const design = currentVersion(versions, "MODULE_DESIGN", module.moduleId)!;
    const requirement = currentVersion(versions, "MODULE_REQUIREMENT", module.moduleId)!;
    if (!hasInputs(design, [requirementSet.versionId, requirement.versionId])) return undefined;
  }
  for (const contract of map.interfaces) {
    const design = currentVersion(versions, "INTERFACE_DESIGN", contract.interfaceId)!;
    const requirement = currentVersion(versions, "INTERFACE_REQUIREMENT", contract.interfaceId)!;
    if (!hasInputs(design, [requirementSet.versionId, requirement.versionId])) return undefined;
  }
  return sameSet(set.facts.componentVersionIds, required.map((version) => version!.versionId)) ? set : undefined;
}

function moduleProgress(input: {
  module: BusinessModule;
  versions: ApprovedVersion[];
  requirementSet: ApprovedVersion;
  designSet: ApprovedVersion;
  systemTest: ApprovedVersion | undefined;
  systemAcceptance: ApprovedVersion | undefined;
  pendingCandidates: ProjectStatus["pendingCandidates"];
  runs: RunRecord[];
  events: JournalEvent[];
  testRecords: TestRecord[];
}): ModuleProgress {
  const requirement = currentVersion(input.versions, "MODULE_REQUIREMENT", input.module.moduleId);
  const design = currentVersion(input.versions, "MODULE_DESIGN", input.module.moduleId);
  const code = currentVersion(input.versions, "CODE", input.module.moduleId);
  const moduleTest = currentVersion(input.versions, "MODULE_TEST", input.module.moduleId);
  const validDesign = Boolean(design && requirement && hasInputs(design, [requirement.versionId, input.requirementSet.versionId]));
  const validCode = Boolean(code && design && hasInputs(code, [
    requirement!.versionId, design.versionId, input.requirementSet.versionId, input.designSet.versionId,
  ]));
  const testRecord = moduleTest?.testRecordIds.map((id) => input.testRecords.find((item) => item.testRecordId === id))
    .find((record) => record?.outcome === "PASSED");
  const validModuleTest = Boolean(moduleTest && code && hasInputs(moduleTest, [code.versionId, design!.versionId, input.designSet.versionId]) && testRecord);
  const candidate = input.pendingCandidates.find((item) => item.scopeId === input.module.moduleId);
  const finishedRunIds = new Set(input.events.filter((event) => event.type === "RUN_FINISHED").map((event) => String(event.runId)));
  const activeRun = input.runs.find((run) => run.scope.id === input.module.moduleId && !finishedRunIds.has(run.runId));
  const blockers: string[] = [];
  let stage: ModuleProgress["stage"] = "REQUIREMENTS";
  let state: ModuleProgress["state"] = "NOT_STARTED";
  let recommendedCommand = `/sdlc-spec ${input.module.name}`;

  if (candidate) {
    state = candidate.reviewState === "HOLD" ? "SUSPENDED" : "WAITING_REVIEW";
    recommendedCommand = `/sdlc-review ${input.module.name}`;
  } else if (activeRun) {
    state = "IN_PROGRESS";
    stage = activeRun.commandType === "CODE" ? "CODING" : "MODULE_TEST";
    recommendedCommand = activeRun.command;
  } else if (!requirement) {
    stage = "REQUIREMENTS";
  } else if (!validDesign) {
    stage = "DESIGN";
    state = design ? "INVALIDATED" : "NOT_STARTED";
    recommendedCommand = `/sdlc-design ${input.module.name}`;
  } else if (!validCode) {
    stage = "CODING";
    state = code ? "INVALIDATED" : "NOT_STARTED";
    for (const dependencyId of input.module.dependencies) {
      const dependencyCode = currentVersion(input.versions, "CODE", dependencyId);
      if (!dependencyCode) blockers.push(`依赖模块尚无已批准代码: ${dependencyId}`);
    }
    if (blockers.length > 0) state = "BLOCKED";
    recommendedCommand = `/sdlc-code ${input.module.name}`;
  } else if (!validModuleTest) {
    stage = "MODULE_TEST";
    state = moduleTest ? "INVALIDATED" : "NOT_STARTED";
    const latestRecord = input.testRecords
      .filter((record) => record.scope.id === input.module.moduleId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (latestRecord && latestRecord.outcome !== "PASSED") {
      state = "BLOCKED";
      blockers.push(`最近测试结果为 ${latestRecord.outcome}`);
    }
    recommendedCommand = `/sdlc-test ${input.module.name}`;
  } else if (!input.systemAcceptance) {
    stage = "SYSTEM_TEST";
    state = "NOT_STARTED";
    recommendedCommand = "/sdlc-test system";
  } else {
    stage = "COMPLETED";
    state = "COMPLETED";
    recommendedCommand = "/sdlc-status";
  }

  return {
    moduleId: input.module.moduleId,
    moduleName: input.module.name,
    stage,
    state,
    ...(requirement ? { requirementVersionId: requirement.versionId } : {}),
    ...(design ? { designVersionId: design.versionId } : {}),
    ...(code ? { codeVersionId: code.versionId } : {}),
    ...(moduleTest ? { moduleTestVersionId: moduleTest.versionId } : {}),
    ...(input.systemTest ? { systemTestVersionId: input.systemTest.versionId } : {}),
    ...(testRecord ? { unitTestResult: testRecord.outcome, moduleTestResult: testRecord.outcome } : {}),
    ...(input.systemTest ? { systemTestResult: "PASSED" } : {}),
    blockers,
    ...(recommendedCommand ? { recommendedCommand } : {}),
  };
}

function validSystemTest(
  versions: ApprovedVersion[],
  map: ReturnType<typeof findRequirementMap>,
  designSet: ApprovedVersion | undefined,
  records: TestRecord[],
): ApprovedVersion | undefined {
  if (!map || !designSet) return undefined;
  const systemTest = currentVersion(versions, "SYSTEM_TEST", "system");
  if (!systemTest) return undefined;
  const required = [designSet.versionId];
  for (const module of map.businessModules.filter((item) => item.status === "ACTIVE")) {
    const code = currentVersion(versions, "CODE", module.moduleId);
    const moduleTest = currentVersion(versions, "MODULE_TEST", module.moduleId);
    if (!code || !moduleTest) return undefined;
    required.push(code.versionId, moduleTest.versionId);
  }
  const passedRecord = systemTest.testRecordIds.map((id) => records.find((record) => record.testRecordId === id))
    .some((record) => record?.outcome === "PASSED");
  return passedRecord && hasInputs(systemTest, required) ? systemTest : undefined;
}

function validAcceptance(versions: ApprovedVersion[], systemTest: ApprovedVersion | undefined): ApprovedVersion | undefined {
  if (!systemTest) return undefined;
  const acceptance = currentVersion(versions, "SYSTEM_ACCEPTANCE", "system");
  return acceptance && hasInputs(acceptance, [systemTest.versionId]) ? acceptance : undefined;
}

function recommend(input: {
  pendingCandidates: ProjectStatus["pendingCandidates"];
  versions: ApprovedVersion[];
  map: ReturnType<typeof findRequirementMap>;
  requirementSet: ApprovedVersion | undefined;
  designSet: ApprovedVersion | undefined;
  modules: ModuleProgress[] | undefined;
  systemTest: ApprovedVersion | undefined;
  systemAcceptance: ApprovedVersion | undefined;
}): RecommendedAction {
  const candidate = input.pendingCandidates.find((item) => item.reviewState === "PENDING") ?? input.pendingCandidates[0];
  if (candidate) return action("REVIEW", `/sdlc-review ${candidate.scopeName === "项目" ? "" : candidate.scopeName}`.trim(), "存在等待人工决定的候选");
  if (!currentVersion(input.versions, "PRODUCT_BRIEF", "project") || !input.map) {
    return action("SPEC", "/sdlc-spec", "需要建立产品概述和需求地图");
  }
  for (const module of input.map.businessModules.filter((item) => item.status === "ACTIVE")) {
    if (!currentVersion(input.versions, "MODULE_REQUIREMENT", module.moduleId)) {
      return action("SPEC", `/sdlc-spec ${module.name}`, "业务模块需求尚未批准");
    }
  }
  for (const contract of input.map.interfaces) {
    if (!currentVersion(input.versions, "INTERFACE_REQUIREMENT", contract.interfaceId)) {
      return action("SPEC", "/sdlc-spec", `外部接口需求尚未批准: ${contract.name}`);
    }
  }
  for (const quality of input.map.qualityRequirements) {
    if (!currentVersion(input.versions, "QUALITY_REQUIREMENT", quality.qualityId)) {
      return action("SPEC", "/sdlc-spec", `非功能需求尚未批准: ${quality.name}`);
    }
  }
  if (!input.requirementSet) return action("SPEC", "/sdlc-spec", "需要生成并审核总需求版本");
  if (!currentVersion(input.versions, "PRODUCT_ARCHITECTURE", "project")) {
    return action("DESIGN", "/sdlc-design", "产品总体设计尚未批准");
  }
  for (const module of input.map.businessModules.filter((item) => item.status === "ACTIVE")) {
    if (!currentVersion(input.versions, "MODULE_DESIGN", module.moduleId)) {
      return action("DESIGN", `/sdlc-design ${module.name}`, "业务模块设计和测试说明尚未批准");
    }
  }
  for (const contract of input.map.interfaces) {
    if (!currentVersion(input.versions, "INTERFACE_DESIGN", contract.interfaceId)) {
      return action("DESIGN", "/sdlc-design", `接口设计尚未批准: ${contract.name}`);
    }
  }
  if (!input.designSet) return action("DESIGN", "/sdlc-design", "需要生成并审核总设计版本");
  const actionable = input.modules?.find((module) => !["COMPLETED", "BLOCKED", "SUSPENDED"].includes(module.state));
  if (actionable?.recommendedCommand) return action(actionable.stage, actionable.recommendedCommand, `推进业务模块: ${actionable.moduleName}`);
  const blocked = input.modules?.find((module) => module.state === "BLOCKED");
  if (blocked?.recommendedCommand) return action(blocked.stage, blocked.recommendedCommand, blocked.blockers.join("；") || "业务模块被阻塞");
  if (!input.systemTest) return action("SYSTEM_TEST", "/sdlc-test system", "模块已具备系统测试条件");
  if (!input.systemAcceptance) return action("SYSTEM_ACCEPTANCE", "/sdlc-test system", "需要形成系统验收候选");
  return action("STATUS", "/sdlc-status", "当前系统验收版本有效");
}

function action(actionName: string, command: string, reason: string): RecommendedAction {
  return { action: actionName, command, todo: `执行 ${command}`, reason };
}

function lifecyclePhase(
  map: ApprovedVersion | undefined,
  requirementSet: ApprovedVersion | undefined,
  designSet: ApprovedVersion | undefined,
  systemTest: ApprovedVersion | undefined,
  acceptance: ApprovedVersion | undefined,
): string {
  if (acceptance) return "已验收";
  if (systemTest) return "系统验收";
  if (designSet) return "编码与测试";
  if (requirementSet) return "设计";
  if (map) return "需求细化";
  return "需求建立";
}

function currentEnvironments(versions: EnvironmentVersion[]): ProjectStatus["environments"] {
  const byId = new Map<string, EnvironmentVersion>();
  for (const version of versions) {
    const current = byId.get(version.environmentId);
    if (!current || version.revision > current.revision) byId.set(version.environmentId, version);
  }
  return [...byId.values()].map(({ environmentVersionId, environmentId, name, contentHash }) => ({
    environmentVersionId, environmentId, name, contentHash,
  }));
}

function hasInputs(version: ApprovedVersion, required: string[]): boolean {
  return required.every((versionId) => version.inputVersionIds.includes(versionId));
}

function sameSet(left: string[], right: string[]): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index]);
}

function isSetFacts(value: ApprovedVersion["facts"]): value is VersionSetFacts {
  return Boolean(value && "componentVersionIds" in value);
}
