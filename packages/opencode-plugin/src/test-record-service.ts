import { readFile } from "node:fs/promises";

import type {
  ArtifactScope,
  CommandEvidence,
  EnvironmentVersion,
  JournalEvent,
  RunRecord,
  TestRecord,
} from "./domain.js";
import { writeLifecycleDocument } from "./document-service.js";
import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { RunService } from "./run-service.js";
import { resolveWorkspacePath } from "./workspace-path.js";

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
    const fingerprintFiles = await hashPaths(this.workspaceRoot, input.fingerprintPaths);
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
      fingerprintFiles: await hashPaths(this.workspaceRoot, fingerprintPaths),
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
    const records = await Promise.all(testRecordIds.map((id) => this.store.readJson<TestRecord>("test-runs", id)));
    const outcome = records.every((record) => record.outcome === "PASSED") ? "PASSED" : "NOT_PASSED";
    const lines = [
      "# 系统测试报告",
      "",
      "## 报告结论",
      "",
      outcome === "PASSED" ? "本报告引用的测试记录全部通过。" : "本报告存在失败、跳过或阻塞记录，不能作为通过结论。",
      "",
      "## 输入版本",
      "",
      ...[...new Set(records.flatMap((record) => record.inputVersionIds))].sort().map((id) => `- ${id}`),
      "",
      "## 环境与实际接口地址",
      "",
      ...reportList(records.flatMap((record) => record.resolvedAddresses)),
      "",
      "## 测试记录",
      "",
    ];
    for (const record of records) {
      lines.push(
        `### ${record.scope.name}（${record.testRecordId}）`,
        "",
        `- 结果：${record.outcome}`,
        `- 运行：${record.runId}`,
        `- 环境版本：${record.environmentVersionId ?? "未使用"}`,
        `- 命令：通过 ${record.passedCommands}，失败 ${record.failedCommands}，跳过 ${record.skippedCommands}，阻塞 ${record.blockedCommands}`,
        `- 指纹：${record.fingerprint}`,
        `- 证据：${record.evidencePaths.length > 0 ? record.evidencePaths.map((item) => item.path).join("、") : "仅有命令证据"}`,
        "",
      );
    }
    lines.push(
      "## 失败、跳过、阻塞和缺失证据",
      "",
      outcome === "PASSED" ? "无。" : "详见上述非 PASSED 测试记录；在问题解决并重新执行前不得批准系统验收。",
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
