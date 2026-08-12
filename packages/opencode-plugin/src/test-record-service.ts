import { readFile } from "node:fs/promises";

import type {
  ApprovedVersion,
  ArtifactScope,
  CommandEvidence,
  EnvironmentVersion,
  JournalEvent,
  RunRecord,
  TestRecord,
} from "./domain.js";
import { safeCommandArguments } from "./command-safety.js";
import { writeLifecycleDocument } from "./document-service.js";
import { effectiveEnvironmentProfile } from "./environment-service.js";
import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { RunService } from "./run-service.js";
import { resolveWorkspacePath } from "./workspace-path.js";
import { existingFilesWithinApprovedPaths, mandatoryFingerprintPaths } from "./version-integrity.js";

type RuntimeValues = { id(): string; now(): string };

type CreateTestRecordInput = {
  runId: string;
  scope: ArtifactScope;
  environmentVersionId?: string;
  fingerprintPaths: string[];
  evidencePaths: string[];
};

export class TestRecordService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly runtime: RuntimeValues,
  ) {}

  async create(input: CreateTestRecordInput): Promise<TestRecord> {
    const run = await this.store.readJson<RunRecord>("runs", input.runId);
    if (run.scope.id !== input.scope.id || run.scope.type !== input.scope.type) {
      throw new Error("测试记录范围与运行范围不一致");
    }
    if (run.commandType === "CODE") throw new Error("编码运行不能直接形成测试记录");
    const runState = await new RunService(this.store, this.runtime).state(input.runId);
    if (runState === "STARTED") throw new Error("运行结束前不能创建测试记录");

    const commandEvidence = (await this.store.listJson<CommandEvidence>("command-evidence"))
      .filter((evidence) => evidence.runId === input.runId)
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
    const environment = input.environmentVersionId
      ? await this.store.readJson<EnvironmentVersion>("environments", input.environmentVersionId)
      : undefined;
    const fingerprintFiles = await hashPaths(this.workspaceRoot, await mandatoryFingerprintPaths(
      this.store,
      this.workspaceRoot,
      run.inputVersionIds,
      [
        ...await existingFilesWithinApprovedPaths(
          this.workspaceRoot,
          [...run.allowedProductPaths, ...run.allowedTestPaths],
        ),
        ...input.fingerprintPaths,
      ],
    ));
    const evidenceFiles = await hashPaths(this.workspaceRoot, input.evidencePaths);
    const fingerprintInput = {
      scope: input.scope,
      inputVersionIds: [...run.inputVersionIds].sort(),
      environmentHash: environment?.contentHash ?? null,
      fingerprintFiles,
      commands: commandEvidence.map((evidence) => ({
        executable: evidence.executable,
        arguments: evidence.arguments,
        workingDirectory: evidence.workingDirectory,
      })),
    };
    const outcome = runState === "SUCCEEDED" ? "PASSED" : runState === "FAILED" ? "FAILED" : "BLOCKED";
    const events = (await this.store.readJournal<JournalEvent>()).filter((event) => event.runId === input.runId);
    const finished = [...events].reverse().find((event) => event.type === "RUN_FINISHED");
    const testRecord: TestRecord = {
      testRecordId: this.runtime.id(),
      scope: input.scope,
      runId: input.runId,
      outcome,
      inputVersionIds: run.inputVersionIds,
      ...(environment ? {
        environmentVersionId: environment.environmentVersionId,
        environmentHash: environment.contentHash,
      } : {}),
      resolvedAddresses: environment ? resolvedAddresses(environment) : [],
      commandEvidenceIds: commandEvidence.map((evidence) => evidence.evidenceId),
      passedCommands: commandEvidence.filter((evidence) => evidence.exitCode === 0 && !evidence.timedOut).length,
      failedCommands: commandEvidence.filter((evidence) => evidence.exitCode !== 0 || evidence.timedOut).length,
      skippedCommands: 0,
      blockedCommands: runState === "BLOCKED" ? 1 : 0,
      assertionCountsAvailable: false,
      fingerprintFiles,
      evidencePaths: evidenceFiles,
      fingerprint: sha256(Buffer.from(JSON.stringify(fingerprintInput), "utf8")),
      startedAt: run.createdAt,
      finishedAt: String(finished?.at ?? this.runtime.now()),
      createdAt: this.runtime.now(),
    };
    await this.store.writeImmutable("test-runs", testRecord.testRecordId, testRecord);
    await this.store.appendJournal({
      type: "TEST_RECORD_CREATED",
      at: testRecord.createdAt,
      testRecordId: testRecord.testRecordId,
      runId: testRecord.runId,
      scope: testRecord.scope,
      outcome: testRecord.outcome,
      fingerprint: testRecord.fingerprint,
    });
    return testRecord;
  }

  async findReusable(
    scope: ArtifactScope,
    inputVersionIds: string[],
    environmentVersionId: string | undefined,
    fingerprintPaths: string[],
    commands: Array<{ executable: string; arguments: string[]; workingDirectory: string }>,
  ): Promise<TestRecord | undefined> {
    const environment = environmentVersionId
      ? await this.store.readJson<EnvironmentVersion>("environments", environmentVersionId)
      : undefined;
    const fingerprint = sha256(Buffer.from(JSON.stringify({
      scope,
      inputVersionIds: [...inputVersionIds].sort(),
      environmentHash: environment?.contentHash ?? null,
      fingerprintFiles: await hashPaths(this.workspaceRoot, await mandatoryFingerprintPaths(
        this.store,
        this.workspaceRoot,
        inputVersionIds,
        fingerprintPaths,
      )),
      commands,
    }), "utf8"));
    return (await this.store.listJson<TestRecord>("test-runs"))
      .filter((record) => record.scope.id === scope.id && record.outcome === "PASSED" && record.fingerprint === fingerprint)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }
}

export class VerificationReportService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
  ) {}

  async generate(testRecordIds: string[]): Promise<{ targetPath: string; sha256: string; outcome: string }> {
    if (testRecordIds.length === 0 || new Set(testRecordIds).size !== testRecordIds.length) {
      throw new Error("测试报告必须引用至少一条且不重复的测试记录");
    }
    const [records, allRecords, environments, evidence, versions] = await Promise.all([
      Promise.all(testRecordIds.map((id) => this.store.readJson<TestRecord>("test-runs", id))),
      this.store.listJson<TestRecord>("test-runs"),
      this.store.listJson<EnvironmentVersion>("environments"),
      this.store.listJson<CommandEvidence>("command-evidence"),
      this.store.listJson<ApprovedVersion>("approved-versions"),
    ]);
    const outcome = records.every((record) => record.outcome === "PASSED") ? "PASSED" : "NOT_PASSED";
    const environmentById = new Map(environments.map((environment) => [environment.environmentVersionId, environment]));
    const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
    const profiles = records.map((record) => {
      const environment = record.environmentVersionId
        ? environmentById.get(record.environmentVersionId)
        : undefined;
      return environment ? effectiveEnvironmentProfile(environment) : "UNSPECIFIED" as const;
    });
    const profile = profiles.some((item) => item === "SIMULATION")
      ? "SIMULATION"
      : profiles.length > 0 && profiles.every((item) => item === "REAL") ? "REAL" : "UNSPECIFIED";
    const selectedIds = new Set(testRecordIds);
    const historical = allRecords
      .filter((record) => record.scope.type === "SYSTEM" && !selectedIds.has(record.testRecordId))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const reusedModuleRecords = versions
      .filter((version) => records.some((record) => record.inputVersionIds.includes(version.versionId))
        && version.kind === "MODULE_TEST")
      .flatMap((version) => version.testRecordIds)
      .map((id) => allRecords.find((record) => record.testRecordId === id))
      .filter((record): record is TestRecord => Boolean(record));
    const lines = [
      "# 系统测试报告",
      "",
      "## 报告结论",
      "",
      outcome !== "PASSED"
        ? "本报告存在失败、跳过或阻塞记录，不能作为通过结论。"
        : profile === "REAL"
          ? "本报告引用的测试记录在明确登记的真实环境中全部通过，可进入正式系统验收审核。"
          : profile === "SIMULATION"
            ? "本报告引用的测试记录在模拟环境中全部通过；仅证明本地插件闭环和跨模块模拟行为，不代表真实设备、真实 TLS、真实凭据或真实外部接口验收。"
            : "本报告引用的测试记录全部通过，但环境未明确分类为真实环境，不能进入正式系统验收。",
      `- 环境级别：${profileLabel(profile)}`,
      `- 正式验收资格：${outcome === "PASSED" && profile === "REAL" ? "具备" : "不具备"}`,
      "",
      "## 输入版本",
      "",
      ...[...new Set(records.flatMap((record) => record.inputVersionIds))].sort().map((id) => `- ${id}`),
      "",
      "## 环境与声明地址",
      "",
      ...reportList(records.flatMap((record) => record.resolvedAddresses)),
      "",
      "以上地址来自不可变环境版本；是否真正建立网络连接必须以受控命令和测试实现证据为准。",
      "",
      "## 测试记录",
      "",
    ];
    for (const record of records) {
      const environment = record.environmentVersionId ? environmentById.get(record.environmentVersionId) : undefined;
      const commands = record.commandEvidenceIds.map((id) => evidenceById.get(id)).filter((item): item is CommandEvidence => Boolean(item));
      lines.push(
        `### ${record.scope.name}（${record.testRecordId}）`,
        "",
        `- 结果：${outcomeLabel(record.outcome)}`,
        `- 运行：${record.runId}`,
        `- 环境版本：${record.environmentVersionId ?? "未使用"}`,
        `- 环境级别：${profileLabel(environment ? effectiveEnvironmentProfile(environment) : "UNSPECIFIED")}`,
        `- 环境名称：${environment?.name ?? "未登记"}`,
        `- 环境用途：${environment?.purpose ?? "未登记"}`,
        `- 命令：通过 ${record.passedCommands}，失败 ${record.failedCommands}，跳过 ${record.skippedCommands}，阻塞 ${record.blockedCommands}`,
        `- 断言计数：${record.assertionCountsAvailable ? "可用" : "不可用"}`,
        `- 指纹：${record.fingerprint}`,
        `- 指纹文件：${record.fingerprintFiles && record.fingerprintFiles.length > 0 ? record.fingerprintFiles.map((item) => item.path).join("、") : "无（旧记录）"}`,
        `- 证据：${record.evidencePaths.length > 0 ? record.evidencePaths.map((item) => item.path).join("、") : "仅有命令证据"}`,
        "",
        "受控命令：",
        "",
        ...reportList(commands.map((item) => `${item.evidenceId}：${item.executable} ${safeCommandArguments(item.arguments).join(" ")}；退出码 ${item.exitCode ?? "无"}；超时 ${item.timedOut ? "是" : "否"}；耗时 ${item.durationMs} ms`)),
        "",
      );
    }
    lines.push(
      "## 复用的模块测试记录",
      "",
      ...reportList(reusedModuleRecords.map((record) => `${record.scope.name}（${record.testRecordId}）：${outcomeLabel(record.outcome)}，指纹 ${record.fingerprint}`)),
      "",
      "系统阶段复用当前有效模块测试记录，不为节省报告篇幅而重跑单元测试。",
      "",
      "## 历史系统测试尝试",
      "",
      ...reportList(historical.map((record) => `${record.testRecordId}：${outcomeLabel(record.outcome)}，运行 ${record.runId}`)),
      "",
      "历史失败或阻塞仍保存在不可变事实中；本报告结论只针对上方明确引用的测试记录。",
      "",
    );
    lines.push(
      "## 失败、跳过、阻塞和缺失证据",
      "",
      outcome === "PASSED"
        ? "所选测试记录没有失败、跳过或阻塞；历史尝试不属于本次通过结论，详见上一节。"
        : "详见上述非 PASSED 测试记录；在问题解决并重新执行前不得批准系统验收。",
      "",
      "## 人工检查项",
      "",
      "- 核对测试范围、环境版本、实际接口地址和证据路径。",
      "- 核对关键跨模块流程是否包含 Playwright 运行证据。",
      "",
      "本文件由结构化测试记录自动生成，结论不得手工改写。",
      "",
    );
    const targetPath = "docs/verification/verification-report.md";
    const result = await writeLifecycleDocument(this.workspaceRoot, targetPath, lines.join("\n"));
    return { ...result, outcome };
  }
}

export async function testRecordFingerprintFilesCurrent(
  workspaceRoot: string,
  record: TestRecord,
): Promise<boolean> {
  if (!record.fingerprintFiles) return true;
  for (const file of record.fingerprintFiles) {
    try {
      const bytes = await readFile(await resolveWorkspacePath(workspaceRoot, file.path));
      if (bytes.byteLength !== file.size || sha256(bytes) !== file.sha256) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  return true;
}

async function hashPaths(workspaceRoot: string, paths: string[]) {
  const unique = [...new Set(paths)].sort();
  return Promise.all(unique.map(async (candidate) => {
    const bytes = await readFile(await resolveWorkspacePath(workspaceRoot, candidate));
    return { path: candidate.replaceAll("\\", "/"), sha256: sha256(bytes), size: bytes.byteLength };
  }));
}

function resolvedAddresses(environment: EnvironmentVersion): string[] {
  return [
    environment.applicationUrl,
    environment.readinessUrl,
    ...environment.externalInterfaces.map((item) => item.address),
    ...environment.dependencies.map((item) => item.address),
  ].filter((value): value is string => Boolean(value));
}

function reportList(values: string[]): string[] {
  const unique = [...new Set(values)].sort();
  return unique.length > 0 ? unique.map((value) => `- ${value}`) : ["- 未配置实际地址。"];
}

function profileLabel(profile: "SIMULATION" | "REAL" | "UNSPECIFIED"): string {
  return profile === "SIMULATION" ? "模拟" : profile === "REAL" ? "真实" : "未明确";
}

function outcomeLabel(outcome: TestRecord["outcome"]): string {
  return outcome === "PASSED" ? "通过" : outcome === "FAILED" ? "失败" : "阻塞";
}
