import { readFile } from "node:fs/promises";
import path from "node:path";

import { findModule, findRequirementMap, validateArtifact } from "./artifact-validator.js";
import type {
  ApprovedVersion,
  ArtifactKind,
  ArtifactScope,
  Candidate,
  CandidateFacts,
  CandidateProvenance,
  ChangeType,
  RunRecord,
  TestRecord,
} from "./domain.js";
import { assertRealAcceptanceRecords } from "./environment-service.js";
import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { RunService } from "./run-service.js";
import { resolveWorkspacePath, toWorkspaceRelativePath } from "./workspace-path.js";

const STABLE_ID = /^[a-z][a-z0-9-]{1,63}$/u;
const DOCUMENT_EXTENSIONS = new Set([".md", ".yaml", ".yml"]);
const EXECUTABLE_KINDS = new Set<ArtifactKind>(["CODE", "MODULE_TEST", "SYSTEM_TEST"]);

export type CreateCandidateInput = {
  kind: ArtifactKind;
  scope: ArtifactScope;
  subjectPaths: string[];
  parentVersionId?: string;
  inputVersionIds: string[];
  sourceIds: string[];
  testRecordIds: string[];
  changeType: ChangeType;
  changeSummary: string;
  proposedImpactScopeIds: string[];
  facts?: CandidateFacts;
  provenance?: CandidateProvenance;
  createdBySessionId: string;
};

type RuntimeValues = {
  id(): string;
  now(): string;
};

export class CandidateService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly runtime: RuntimeValues,
  ) {}

  async create(input: CreateCandidateInput): Promise<Candidate> {
    return this.createInternal(input, { entry: "GENERAL" });
  }

  async createFromSetService(input: CreateCandidateInput): Promise<Candidate> {
    if (!["REQUIREMENT_SET", "DESIGN_SET"].includes(input.kind)) {
      throw new Error("集合专用入口只允许创建 REQUIREMENT_SET 或 DESIGN_SET");
    }
    return this.createInternal(input, { entry: "SET" });
  }

  async createModuleTest(testRecordId: string, createdBySessionId: string): Promise<Candidate> {
    const record = await this.store.readJson<TestRecord>("test-runs", testRecordId);
    if (record.scope.type !== "MODULE") throw new Error("模块测试候选只能引用业务模块测试记录");
    const run = await this.store.readJson<RunRecord>("runs", record.runId);
    if (run.commandType !== "MODULE_TEST") {
      throw new Error("模块测试记录不属于模块测试运行");
    }
    const versions = await this.store.listJson<ApprovedVersion>("approved-versions");
    const current = currentVersion(versions, "MODULE_TEST", record.scope.id);
    return this.createInternal({
      kind: "MODULE_TEST",
      scope: record.scope,
      subjectPaths: [],
      ...(current ? { parentVersionId: current.versionId } : {}),
      inputVersionIds: run.inputVersionIds,
      sourceIds: [],
      testRecordIds: [testRecordId],
      changeType: "BEHAVIOR",
      changeSummary: "依据当前模块测试运行及其通过记录形成模块测试候选；测试代码由已批准代码版本固定。",
      proposedImpactScopeIds: [],
      provenance: {
        runId: run.runId,
        gitBase: run.gitBase,
        inputVersionIds: run.inputVersionIds,
        testRecordIds: [testRecordId],
      },
      createdBySessionId,
    }, { entry: "MODULE_TEST" });
  }

  async createSystemTest(testRecordId: string, createdBySessionId: string): Promise<Candidate> {
    const record = await this.store.readJson<TestRecord>("test-runs", testRecordId);
    if (record.scope.type !== "SYSTEM" || record.scope.id !== "system") {
      throw new Error("系统测试候选只能引用系统测试记录");
    }
    const run = await this.store.readJson<RunRecord>("runs", record.runId);
    if (run.commandType !== "SYSTEM_TEST") {
      throw new Error("系统测试记录不属于系统测试运行");
    }
    const versions = await this.store.listJson<ApprovedVersion>("approved-versions");
    const current = currentVersion(versions, "SYSTEM_TEST", "system");
    return this.createInternal({
      kind: "SYSTEM_TEST",
      scope: { type: "SYSTEM", id: "system", name: "系统" },
      subjectPaths: ["docs/verification/verification-report.md"],
      ...(current ? { parentVersionId: current.versionId } : {}),
      inputVersionIds: run.inputVersionIds,
      sourceIds: [],
      testRecordIds: [testRecordId],
      changeType: "BEHAVIOR",
      changeSummary: "依据当前系统测试运行、自动报告及其通过记录形成系统测试候选。",
      proposedImpactScopeIds: [],
      provenance: {
        runId: run.runId,
        gitBase: run.gitBase,
        inputVersionIds: run.inputVersionIds,
        testRecordIds: [testRecordId],
      },
      createdBySessionId,
    }, { entry: "SYSTEM_TEST" });
  }

  async createSystemAcceptance(createdBySessionId: string): Promise<Candidate> {
    const versions = await this.store.listJson<ApprovedVersion>("approved-versions");
    const systemTest = currentVersion(versions, "SYSTEM_TEST", "system");
    if (!systemTest) throw new Error("当前没有已批准的系统测试版本");
    const currentAcceptance = currentVersion(versions, "SYSTEM_ACCEPTANCE", "system");
    return this.createInternal({
      kind: "SYSTEM_ACCEPTANCE",
      scope: { type: "SYSTEM", id: "system", name: "系统" },
      subjectPaths: systemTest.subjectPaths,
      ...(currentAcceptance ? { parentVersionId: currentAcceptance.versionId } : {}),
      inputVersionIds: [systemTest.versionId],
      sourceIds: [],
      testRecordIds: systemTest.testRecordIds,
      changeType: "CLARIFICATION",
      changeSummary: "依据当前已批准系统测试版本及其测试记录形成系统验收候选；未重新执行测试。",
      proposedImpactScopeIds: [],
      createdBySessionId,
    }, { entry: "SYSTEM_ACCEPTANCE" });
  }

  private async createInternal(
    input: CreateCandidateInput,
    options: { entry: "GENERAL" | "SET" | "MODULE_TEST" | "SYSTEM_TEST" | "SYSTEM_ACCEPTANCE" },
  ): Promise<Candidate> {
    validateIdentityAndScope(input.kind, input.scope);
    if (!input.changeSummary.trim()) throw new Error("候选必须包含修订摘要");
    const requestedPaths = normalizeSubjectPaths(input.subjectPaths);
    if (requestedPaths.length === 0 && input.testRecordIds.length === 0) {
      throw new Error("候选至少需要一个文件或测试记录");
    }

    const approvedVersions = await this.store.listJson<ApprovedVersion>("approved-versions");
    const current = currentVersion(approvedVersions, input.kind, input.scope.id);
    const normalizedPaths = revisionSubjectPaths(input.kind, current, requestedPaths);
    await this.validateReferences(input, approvedVersions);
    this.validateScope(input, approvedVersions);
    await this.validateLifecycleInputs(
      input,
      approvedVersions,
      normalizedPaths,
      options.entry,
    );
    if (current?.versionId !== input.parentVersionId) {
      throw new Error(current
        ? `父版本必须是当前已批准版本: ${current.versionId}`
        : "首个修订不能声明父版本");
    }

    const candidateId = this.runtime.id();
    const textByPath = new Map<string, string>();
    const subjects = [];
    for (const subjectPath of normalizedPaths) {
      const resolved = await resolveWorkspacePath(this.workspaceRoot, subjectPath);
      const bytes = await readFile(resolved);
      const subjectHash = sha256(bytes);
      const absoluteSnapshotPath = await this.store.ensureImmutableBytes(
        path.join("objects", "sha256", subjectHash.slice(0, 2), subjectHash),
        bytes,
      );
      const snapshotPath = toWorkspaceRelativePath(this.workspaceRoot, absoluteSnapshotPath);
      subjects.push({ path: subjectPath, sha256: subjectHash, size: bytes.byteLength, snapshotPath });
      if (DOCUMENT_EXTENSIONS.has(path.extname(subjectPath).toLowerCase())) {
        textByPath.set(subjectPath, bytes.toString("utf8"));
      }
    }

    const deterministicChecks = validateArtifact({
      kind: input.kind,
      scope: input.scope,
      subjects,
      textByPath,
      ...(input.facts ? { facts: input.facts } : {}),
      approvedVersions,
    });
    const revision = (current?.revision ?? 0) + 1;
    const hashInput = {
      kind: input.kind,
      scope: input.scope,
      revision,
      ...(input.parentVersionId ? { parentVersionId: input.parentVersionId } : {}),
      subjects: subjects.map(({ path: subjectPath, sha256: subjectHash, size }) => ({
        path: subjectPath,
        sha256: subjectHash,
        size,
      })),
      inputVersionIds: [...input.inputVersionIds].sort(),
      sourceIds: [...input.sourceIds].sort(),
      testRecordIds: [...input.testRecordIds].sort(),
      changeType: input.changeType,
      changeSummary: input.changeSummary.trim(),
      proposedImpactScopeIds: [...input.proposedImpactScopeIds].sort(),
      ...(input.facts ? { facts: input.facts } : {}),
      ...(input.provenance ? { provenance: input.provenance } : {}),
    };
    const candidate: Candidate = {
      candidateId,
      ...hashInput,
      contentHash: sha256(Buffer.from(JSON.stringify(hashInput), "utf8")),
      subjectPaths: normalizedPaths,
      subjects,
      deterministicChecks,
      createdBySessionId: input.createdBySessionId,
      createdAt: this.runtime.now(),
    };
    await this.store.writeImmutable("candidates", candidate.candidateId, candidate);
    await this.store.appendJournal({
      type: "CANDIDATE_CREATED",
      at: candidate.createdAt,
      candidateId: candidate.candidateId,
      candidateHash: candidate.contentHash,
      kind: candidate.kind,
      scope: candidate.scope,
    });
    return candidate;
  }

  private async validateReferences(input: CreateCandidateInput, versions: ApprovedVersion[]): Promise<void> {
    const versionIds = new Set(versions.map((version) => version.versionId));
    for (const versionId of input.inputVersionIds) {
      if (!versionIds.has(versionId)) throw new Error(`输入版本不存在或未批准: ${versionId}`);
    }
    for (const sourceId of input.sourceIds) await this.store.readJson("sources", sourceId);
    for (const testRecordId of input.testRecordIds) {
      await this.store.readJson<TestRecord>("test-runs", testRecordId);
    }
    if (EXECUTABLE_KINDS.has(input.kind)) {
      if (!input.provenance?.runId || !input.provenance.gitBase || input.provenance.inputVersionIds.length === 0) {
        throw new Error(`${input.kind} 候选必须绑定运行、Git 基点和精确输入版本`);
      }
      if (!sameSet(input.provenance.inputVersionIds, input.inputVersionIds)) {
        throw new Error("候选输入版本与运行来源输入版本不一致");
      }
      if (!sameSet(input.provenance.testRecordIds, input.testRecordIds)) {
        throw new Error("候选测试记录与运行来源测试记录不一致");
      }
      await this.store.readJson("runs", input.provenance.runId);
    }
  }

  private validateScope(input: CreateCandidateInput, versions: ApprovedVersion[]): void {
    const projectKinds = new Set<ArtifactKind>([
      "PRODUCT_BRIEF", "REQUIREMENT_MAP", "REQUIREMENT_SET", "PRODUCT_ARCHITECTURE", "DESIGN_SET",
    ]);
    if (projectKinds.has(input.kind) && (input.scope.type !== "PROJECT" || input.scope.id !== "project")) {
      throw new Error(`${input.kind} 必须使用 project 项目范围`);
    }
    if (["MODULE_REQUIREMENT", "MODULE_DESIGN", "CODE", "MODULE_TEST"].includes(input.kind)) {
      if (input.scope.type !== "MODULE" || !findModule(versions, input.scope.id)) {
        throw new Error(`业务模块不存在于当前已批准需求地图: ${input.scope.id}`);
      }
      const module = findModule(versions, input.scope.id)!;
      if (module.name !== input.scope.name || module.status !== "ACTIVE") {
        throw new Error(`业务模块名称或状态与当前需求地图不一致: ${input.scope.name}`);
      }
    }
    if (["INTERFACE_REQUIREMENT", "INTERFACE_DESIGN"].includes(input.kind)) {
      const contract = findRequirementMap(versions)?.interfaces.find((item) => item.interfaceId === input.scope.id);
      if (input.scope.type !== "INTERFACE" || !contract || contract.name !== input.scope.name) {
        throw new Error(`外部接口不存在于当前已批准需求地图: ${input.scope.id}`);
      }
    }
    if (input.kind === "QUALITY_REQUIREMENT") {
      const quality = findRequirementMap(versions)?.qualityRequirements.find((item) => item.qualityId === input.scope.id);
      if (input.scope.type !== "QUALITY" || !quality || quality.name !== input.scope.name) {
        throw new Error(`非功能需求不存在于当前已批准需求地图: ${input.scope.id}`);
      }
    }
    if (["SYSTEM_TEST", "SYSTEM_ACCEPTANCE"].includes(input.kind)
      && (input.scope.type !== "SYSTEM" || input.scope.id !== "system")) {
      throw new Error(`${input.kind} 必须使用 system 系统范围`);
    }
  }

  private async validateLifecycleInputs(
    input: CreateCandidateInput,
    versions: ApprovedVersion[],
    subjectPaths: string[],
    entry: "GENERAL" | "SET" | "MODULE_TEST" | "SYSTEM_TEST" | "SYSTEM_ACCEPTANCE",
  ): Promise<void> {
    const mapVersion = currentVersion(versions, "REQUIREMENT_MAP", "project");
    const requirementSet = currentVersion(versions, "REQUIREMENT_SET", "project");
    const designSet = currentVersion(versions, "DESIGN_SET", "project");
    const requireInputs = (required: Array<ApprovedVersion | undefined>) => {
      for (const version of required) {
        if (!version) throw new Error(`缺少 ${input.kind} 的前置已批准版本`);
        if (!input.inputVersionIds.includes(version.versionId)) {
          throw new Error(`${input.kind} 未绑定当前前置版本: ${version.versionId}`);
        }
      }
    };
    switch (input.kind) {
      case "MODULE_REQUIREMENT":
      case "INTERFACE_REQUIREMENT":
      case "QUALITY_REQUIREMENT":
        requireInputs([mapVersion]);
        break;
      case "PRODUCT_ARCHITECTURE":
        requireInputs([requirementSet]);
        break;
      case "MODULE_DESIGN":
        requireInputs([requirementSet, currentVersion(versions, "MODULE_REQUIREMENT", input.scope.id)]);
        break;
      case "INTERFACE_DESIGN":
        requireInputs([requirementSet, currentVersion(versions, "INTERFACE_REQUIREMENT", input.scope.id)]);
        break;
      case "CODE":
        requireInputs([
          requirementSet,
          designSet,
          currentVersion(versions, "MODULE_REQUIREMENT", input.scope.id),
          currentVersion(versions, "MODULE_DESIGN", input.scope.id),
        ]);
        for (const dependencyId of findModule(versions, input.scope.id)?.dependencies ?? []) {
          requireInputs([currentVersion(versions, "CODE", dependencyId)]);
        }
        await this.validateSuccessfulRunAndPaths(input, subjectPaths);
        break;
      case "MODULE_TEST":
        if (entry !== "MODULE_TEST") {
          throw new Error("MODULE_TEST 必须通过 sdlc_module_test_candidate_create 生成");
        }
        if (subjectPaths.length !== 0) {
          throw new Error("模块测试候选只引用测试记录，不重复快照测试代码");
        }
        requireInputs([
          designSet,
          currentVersion(versions, "MODULE_DESIGN", input.scope.id),
          currentVersion(versions, "CODE", input.scope.id),
        ]);
        for (const dependencyId of findModule(versions, input.scope.id)?.dependencies ?? []) {
          requireInputs([currentVersion(versions, "CODE", dependencyId)]);
        }
        await this.validateSuccessfulRunAndPaths(input, subjectPaths);
        await this.requirePassingTestRecord(input);
        break;
      case "SYSTEM_TEST":
        if (entry !== "SYSTEM_TEST") {
          throw new Error("SYSTEM_TEST 必须通过 sdlc_system_test_candidate_create 生成");
        }
        if (!sameSet(subjectPaths, ["docs/verification/verification-report.md"])) {
          throw new Error("系统测试候选只能包含自动生成的系统测试报告");
        }
        requireInputs([designSet]);
        for (const module of findRequirementMap(versions)?.businessModules.filter((item) => item.status === "ACTIVE") ?? []) {
          requireInputs([
            currentVersion(versions, "CODE", module.moduleId),
            currentVersion(versions, "MODULE_TEST", module.moduleId),
          ]);
        }
        await this.validateSuccessfulRunAndPaths(input, subjectPaths);
        await this.requirePassingTestRecord(input);
        break;
      case "SYSTEM_ACCEPTANCE":
        {
          if (entry !== "SYSTEM_ACCEPTANCE") {
            throw new Error("SYSTEM_ACCEPTANCE 必须通过 sdlc_system_acceptance_candidate_create 生成");
          }
          const systemTest = currentVersion(versions, "SYSTEM_TEST", "system");
          if (!systemTest || !sameSet(input.inputVersionIds, [systemTest.versionId])) {
            throw new Error("系统验收必须且只能绑定当前系统测试版本");
          }
          if (!sameSet(subjectPaths, systemTest.subjectPaths)) {
            throw new Error("系统验收必须精确复用当前系统测试报告");
          }
          await this.requireCurrentVersionBytes(systemTest);
          await this.requireAcceptanceTestRecords(input, systemTest!);
        }
        break;
      case "REQUIREMENT_SET":
      case "DESIGN_SET":
        if (entry !== "SET") {
          throw new Error(`${input.kind} 必须通过 sdlc_set_candidate_create 生成`);
        }
        break;
      default:
        break;
    }
  }

  private async validateSuccessfulRunAndPaths(input: CreateCandidateInput, subjectPaths: string[]): Promise<void> {
    const runId = input.provenance!.runId;
    const run = await this.store.readJson<RunRecord>("runs", runId);
    if (run.scope.id !== input.scope.id || run.gitBase !== input.provenance!.gitBase) {
      throw new Error("候选范围或 Git 基点与运行记录不一致");
    }
    if (await new RunService(this.store, this.runtime).state(runId) !== "SUCCEEDED") {
      throw new Error("只有真实成功的运行才能创建可执行产物候选");
    }
    if (input.kind === "CODE") {
      const allowed = [...run.allowedProductPaths, ...run.allowedTestPaths];
      for (const subjectPath of subjectPaths) {
        if (!allowed.some((prefix) => isWithinApprovedPath(subjectPath, prefix))) {
          throw new Error(`代码候选文件超出模块设计批准的路径边界: ${subjectPath}`);
        }
      }
    }
    if (input.kind === "MODULE_TEST") {
      for (const subjectPath of subjectPaths) {
        if (!run.allowedTestPaths.some((prefix) => isWithinApprovedPath(subjectPath, prefix))) {
          throw new Error(`模块测试候选文件超出模块设计批准的测试路径边界: ${subjectPath}`);
        }
      }
    }
  }

  private async requirePassingTestRecord(input: CreateCandidateInput): Promise<void> {
    if (input.testRecordIds.length === 0) throw new Error(`${input.kind} 候选必须引用测试记录`);
    for (const testRecordId of input.testRecordIds) {
      const record = await this.store.readJson<TestRecord>("test-runs", testRecordId);
      if (record.outcome !== "PASSED"
        || record.runId !== input.provenance!.runId
        || !sameSet(record.inputVersionIds, input.inputVersionIds)) {
        throw new Error(`测试记录未通过或不属于当前运行: ${testRecordId}`);
      }
    }
  }

  private async requireAcceptanceTestRecords(input: CreateCandidateInput, systemTest: ApprovedVersion): Promise<void> {
    if (!sameSet(input.testRecordIds, systemTest.testRecordIds) || input.testRecordIds.length === 0) {
      throw new Error("系统验收必须精确引用当前系统测试版本中的测试记录");
    }
    for (const testRecordId of input.testRecordIds) {
      const record = await this.store.readJson<TestRecord>("test-runs", testRecordId);
      if (record.outcome !== "PASSED") throw new Error(`系统验收引用了未通过的测试记录: ${testRecordId}`);
    }
    await assertRealAcceptanceRecords(this.store, input.testRecordIds);
  }

  private async requireCurrentVersionBytes(version: ApprovedVersion): Promise<void> {
    for (const subject of version.subjects) {
      const bytes = await readFile(await resolveWorkspacePath(this.workspaceRoot, subject.path));
      if (bytes.byteLength !== subject.size || sha256(bytes) !== subject.sha256) {
        throw new Error(`当前系统测试报告与已批准版本不一致: ${subject.path}`);
      }
    }
  }
}

export function currentVersion(
  versions: ApprovedVersion[],
  kind: ArtifactKind,
  scopeId: string,
): ApprovedVersion | undefined {
  return versions
    .filter((version) => version.kind === kind && version.scope.id === scopeId)
    .sort((left, right) => right.revision - left.revision)[0];
}

export function revisionSubjectPaths(
  kind: ArtifactKind,
  current: ApprovedVersion | undefined,
  requestedPaths: string[],
): string[] {
  return kind === "CODE" && current
    ? [...new Set([...current.subjectPaths, ...requestedPaths])].sort()
    : requestedPaths;
}

function validateIdentityAndScope(kind: ArtifactKind, scope: ArtifactScope): void {
  if (!STABLE_ID.test(scope.id) || !scope.name.trim()) throw new Error(`候选范围编号或名称无效: ${scope.id}`);
  if (kind === "CODE" && scope.type !== "MODULE") throw new Error("代码候选只能属于业务模块");
}

function normalizeSubjectPaths(subjectPaths: string[]): string[] {
  const normalized = subjectPaths.map((subjectPath) => path.normalize(subjectPath).replaceAll("\\", "/"));
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) throw new Error("候选文件路径不能重复");
  if (normalized.some((subjectPath) => path.isAbsolute(subjectPath) || subjectPath === ".." || subjectPath.startsWith("../"))) {
    throw new Error("候选文件必须位于项目工作区内");
  }
  return [...unique].sort();
}

function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

export function isWithinApprovedPath(subjectPath: string, allowedPattern: string): boolean {
  const subject = path.normalize(subjectPath).replaceAll("\\", "/");
  const pattern = path.normalize(allowedPattern).replaceAll("\\", "/");
  if (/[?*]/u.test(pattern)) return globPattern(pattern).test(subject);
  const prefix = path.normalize(pattern);
  const relative = path.relative(prefix, subject);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function globPattern(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length;) {
    if (pattern.startsWith("**/", index)) {
      source += "(?:.*/)?";
      index += 3;
    } else if (pattern.startsWith("**", index)) {
      source += ".*";
      index += 2;
    } else if (pattern[index] === "*") {
      source += "[^/]*";
      index += 1;
    } else if (pattern[index] === "?") {
      source += "[^/]";
      index += 1;
    } else {
      source += pattern[index]!.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
      index += 1;
    }
  }
  return new RegExp(`^${source}$`, "u");
}
