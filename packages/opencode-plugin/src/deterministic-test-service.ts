import { CandidateService } from "./candidate-service.js";
import { safeCommandArguments } from "./command-safety.js";
import { ControlledExecutionService } from "./controlled-execution.js";
import type { ApprovedVersion, Candidate, CommandEvidence, TestRecord } from "./domain.js";
import type { ProjectStore } from "./project-store.js";
import { RunPreparationService } from "./run-preparation-service.js";
import { RunService } from "./run-service.js";
import { findModuleByExactName, StatusService } from "./status-service.js";
import { TestRecordService, VerificationReportService } from "./test-record-service.js";

type RuntimeValues = { id(): string; now(): string };

export type ExistingTestInput = {
  scopeType: "MODULE" | "SYSTEM";
  moduleName?: string;
  recipeTestRecordId?: string;
  environmentVersionId?: string;
  createCandidate: boolean;
  sessionId: string;
};

type RawRecipe = {
  testRecord: TestRecord;
  commands: CommandEvidence[];
};

export class DeterministicTestService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly runtime: RuntimeValues,
  ) {}

  async readRecipe(input: Pick<ExistingTestInput, "scopeType" | "moduleName" | "recipeTestRecordId">) {
    const recipe = await this.resolveRecipe(input);
    return {
      testRecordId: recipe.testRecord.testRecordId,
      scope: recipe.testRecord.scope,
      previousEnvironmentVersionId: recipe.testRecord.environmentVersionId ?? null,
      commands: recipe.commands.map((command) => ({
        executable: command.executable,
        arguments: safeCommandArguments(command.arguments),
        workingDirectory: command.workingDirectory,
        timeoutMs: command.timeoutMs ?? 300_000,
      })),
      replayable: true,
    };
  }

  async execute(input: ExistingTestInput) {
    const startedMs = Date.now();
    const recipe = await this.resolveRecipe(input);
    if (input.createCandidate) {
      const status = await new StatusService(this.store).read();
      const scopeId = input.scopeType === "SYSTEM"
        ? "system"
        : findModuleByExactName(status, input.moduleName!).moduleId;
      const kind = input.scopeType === "SYSTEM" ? "SYSTEM_TEST" : "MODULE_TEST";
      const pending = status.pendingCandidates.find((candidate) => candidate.scopeId === scopeId && candidate.kind === kind);
      if (pending) throw new Error(`当前已有待审核测试候选，不能重复创建: ${pending.candidateId}`);
    }
    if (input.scopeType === "SYSTEM" && !input.environmentVersionId) {
      throw new Error("系统测试确定性重跑必须显式指定环境版本，禁止沿用或猜测历史环境");
    }
    if (recipe.testRecord.environmentVersionId && !input.environmentVersionId) {
      throw new Error(`原测试配方使用环境 ${recipe.testRecord.environmentVersionId}；重跑时必须显式指定环境版本`);
    }

    const command = input.scopeType === "SYSTEM" ? "/sdlc-test system" : `/sdlc-test ${input.moduleName}`;
    const run = await new RunPreparationService(this.store, this.workspaceRoot, this.runtime)
      .start(command, input.scopeType === "SYSTEM" ? undefined : input.moduleName, input.sessionId);
    const runService = new RunService(this.store, this.runtime);
    const execution = new ControlledExecutionService(this.store, this.workspaceRoot, this.runtime);
    const executed: Array<Pick<CommandEvidence, "evidenceId" | "executable" | "arguments" | "workingDirectory" | "exitCode" | "timedOut" | "durationMs">> = [];
    let blockedReason: string | undefined;
    let failed = false;

    for (const recipeCommand of recipe.commands) {
      try {
        const evidence = await execution.execute({
          runId: run.runId,
          executable: recipeCommand.executable,
          arguments: recipeCommand.arguments,
          workingDirectory: recipeCommand.workingDirectory,
          timeoutMs: recipeCommand.timeoutMs ?? 300_000,
        });
        executed.push({
          evidenceId: evidence.evidenceId,
          executable: evidence.executable,
          arguments: safeCommandArguments(evidence.arguments),
          workingDirectory: evidence.workingDirectory,
          exitCode: evidence.exitCode,
          timedOut: evidence.timedOut,
          durationMs: evidence.durationMs,
        });
        if (evidence.exitCode !== 0 || evidence.timedOut) {
          failed = true;
          break;
        }
      } catch (error) {
        blockedReason = error instanceof Error ? error.message : String(error);
        break;
      }
    }

    const runState = blockedReason ? "BLOCKED" as const : failed ? "FAILED" as const : "SUCCEEDED" as const;
    await runService.finish(run.runId, runState);
    const record = await new TestRecordService(this.store, this.workspaceRoot, this.runtime).create({
      runId: run.runId,
      scope: run.scope,
      ...(input.environmentVersionId ? { environmentVersionId: input.environmentVersionId } : {}),
      fingerprintPaths: [],
      evidencePaths: [],
    });

    let report: Awaited<ReturnType<VerificationReportService["generate"]>> | undefined;
    let candidate: Candidate | undefined;
    if (input.createCandidate && input.scopeType === "SYSTEM") {
      report = await new VerificationReportService(this.store, this.workspaceRoot).generate([record.testRecordId]);
    }
    if (input.createCandidate && record.outcome === "PASSED") {
      const candidates = new CandidateService(this.store, this.workspaceRoot, this.runtime);
      candidate = input.scopeType === "SYSTEM"
        ? await candidates.createSystemTest(record.testRecordId, input.sessionId)
        : await candidates.createModuleTest(record.testRecordId, input.sessionId);
    }

    return {
      mode: "DETERMINISTIC_EXISTING_TEST",
      internalModelCalls: 0,
      recipeTestRecordId: recipe.testRecord.testRecordId,
      run: {
        runId: run.runId,
        command: run.command,
        scope: run.scope,
        gitBase: run.gitBase,
        inputVersionIds: run.inputVersionIds,
      },
      record: {
        testRecordId: record.testRecordId,
        outcome: record.outcome,
        ...(record.environmentVersionId ? { environmentVersionId: record.environmentVersionId } : {}),
        passedCommands: record.passedCommands,
        failedCommands: record.failedCommands,
        blockedCommands: record.blockedCommands,
        fingerprint: record.fingerprint,
      },
      ...(report ? { report } : {}),
      ...(candidate ? { candidate: {
        candidateId: candidate.candidateId,
        contentHash: candidate.contentHash,
        kind: candidate.kind,
        scope: candidate.scope,
        revision: candidate.revision,
      } } : {}),
      execution: {
        state: runState,
        attemptedCommands: executed.length,
        plannedCommands: recipe.commands.length,
        commandDurationMs: executed.reduce((total, item) => total + item.durationMs, 0),
        wallDurationMs: Date.now() - startedMs,
        commands: executed,
        ...(blockedReason ? { blockedReason } : {}),
      },
      recommendedAction: candidate
        ? {
          action: "REVIEW",
          command: input.scopeType === "SYSTEM" ? "/sdlc-review" : `/sdlc-review ${record.scope.name}`,
          reason: "确定性测试通过并形成候选，等待人工审核",
        }
        : record.outcome === "PASSED"
          ? { action: "NONE", command: "/sdlc-status", reason: "确定性测试通过并形成记录，未请求候选" }
          : { action: "DIAGNOSE", command: input.scopeType === "SYSTEM" ? "/sdlc-test system" : `/sdlc-test ${record.scope.name}`, reason: "确定性测试未通过；按记录诊断首个失败，不自动重试或修改代码" },
    };
  }

  private async resolveRecipe(
    input: Pick<ExistingTestInput, "scopeType" | "moduleName" | "recipeTestRecordId">,
  ): Promise<RawRecipe> {
    const status = await new StatusService(this.store).read();
    const scope = input.scopeType === "SYSTEM"
      ? { type: "SYSTEM" as const, id: "system", name: "系统" }
      : (() => {
        if (!input.moduleName) throw new Error("模块测试确定性重跑必须提供完整业务模块名称");
        const module = findModuleByExactName(status, input.moduleName);
        return { type: "MODULE" as const, id: module.moduleId, name: module.moduleName };
      })();
    const records = await this.store.listJson<TestRecord>("test-runs");
    let record: TestRecord | undefined;
    if (input.recipeTestRecordId) {
      record = records.find((candidate) => candidate.testRecordId === input.recipeTestRecordId);
      if (!record) throw new Error(`测试配方记录不存在: ${input.recipeTestRecordId}`);
    } else {
      const kind = input.scopeType === "SYSTEM" ? "SYSTEM_TEST" : "MODULE_TEST";
      const versions = (await this.store.listJson<ApprovedVersion>("approved-versions"))
        .filter((version) => version.kind === kind && version.scope.id === scope.id)
        .sort((left, right) => right.revision - left.revision);
      record = versions.flatMap((version) => version.testRecordIds)
        .map((testRecordId) => records.find((candidate) => candidate.testRecordId === testRecordId))
        .find((candidate): candidate is TestRecord => candidate?.outcome === "PASSED");
    }
    if (!record) throw new Error("没有已批准测试版本可提供确定性命令配方；首次测试仍需通过 /sdlc-test 明确命令和环境");
    if (record.outcome !== "PASSED" || record.scope.type !== scope.type || record.scope.id !== scope.id) {
      throw new Error("测试配方必须来自同一范围的已通过测试记录");
    }
    const requiredDesignVersionIds = input.scopeType === "SYSTEM"
      ? [status.designSetVersionId]
      : (() => {
        const module = findModuleByExactName(status, input.moduleName!);
        return [status.designSetVersionId, module.designVersionId];
      })();
    if (requiredDesignVersionIds.some((versionId) => !versionId || !record.inputVersionIds.includes(versionId))) {
      throw new Error("当前测试设计版本与批准命令配方不一致；必须通过 /sdlc-test 重新确认测试命令，不能静默复用旧配方");
    }
    const evidenceById = new Map((await this.store.listJson<CommandEvidence>("command-evidence"))
      .map((evidence) => [evidence.evidenceId, evidence]));
    const allEvidence = record.commandEvidenceIds
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter((evidence): evidence is CommandEvidence => Boolean(evidence))
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
    if (allEvidence.length !== record.commandEvidenceIds.length || allEvidence.length === 0) {
      throw new Error(`测试配方命令证据不完整: ${record.testRecordId}`);
    }
    const latestByCommand = new Map<string, CommandEvidence>();
    for (const evidence of allEvidence) latestByCommand.set(commandKey(evidence), evidence);
    const commands = allEvidence.filter((evidence) => latestByCommand.get(commandKey(evidence)) === evidence);
    if (commands.some((evidence) => evidence.exitCode !== 0 || evidence.timedOut)) {
      throw new Error(`已通过记录的最终命令证据不完整或未通过: ${record.testRecordId}`);
    }
    return { testRecord: record, commands };
  }
}

function commandKey(command: Pick<CommandEvidence, "executable" | "arguments" | "workingDirectory">): string {
  return JSON.stringify([command.executable, command.arguments, command.workingDirectory]);
}
