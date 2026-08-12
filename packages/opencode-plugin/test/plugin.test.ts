import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Candidate, CommandEvidence, EnvironmentVersion, TestRecord } from "../src/domain.js";
import { SdlcFactoryPlugin } from "../src/plugin.js";
import { ProjectStore } from "../src/project-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("SdlcFactoryPlugin", () => {
  it("未初始化时只推荐初始化且不创建项目事实", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);

    const result = JSON.parse(await hooks.tool!.sdlc_status!.execute({}, { sessionID: "session-1" } as never) as string);

    expect(result).toMatchObject({
      initialized: false,
      recommendedAction: { command: "/sdlc-init" },
    });
  });

  it("初始化后状态只从生命周期事实推导且不暴露旧计划工具", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);

    await hooks.tool!.sdlc_init!.execute(
      { projectName: "测试项目", allowedReadRoots: [], allowedExecutables: ["node"] },
      { sessionID: "session-1" } as never,
    );
    const status = JSON.parse(await hooks.tool!.sdlc_status!.execute({}, { sessionID: "session-1" } as never) as string);

    expect(status).toMatchObject({
      initialized: true,
      projectName: "测试项目",
      projectProgressAvailable: false,
      lifecyclePhase: "需求建立",
      recommendedAction: { command: "/sdlc-spec" },
    });
    expect(hooks.tool).not.toHaveProperty("sdlc_plan_save");
    expect(hooks.tool).not.toHaveProperty("sdlc_run_record_result");
    expect(hooks.tool).toHaveProperty("sdlc_module_test_candidate_create");
    expect(hooks.tool).toHaveProperty("sdlc_system_test_candidate_create");
    expect(hooks.tool).toHaveProperty("sdlc_system_acceptance_candidate_create");
  });

  it("分页读取授权来源并保持真实字节", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    const sourceRoot = await mkdtemp(path.join(tmpdir(), "sdlc-source-"));
    temporaryDirectories.push(directory, sourceRoot);
    const sourcePath = path.join(sourceRoot, "requirements.md");
    await writeFile(sourcePath, "0123456789", "utf8");
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks.tool!.sdlc_init!.execute(
      { projectName: "测试项目", allowedReadRoots: [sourceRoot], allowedExecutables: ["node"] },
      { sessionID: "session-1" } as never,
    );
    await hooks["command.execute.before"]!({
      command: "sdlc-spec", sessionID: "session-1", arguments: "",
    }, { parts: [] } as never);
    await hooks.tool!.sdlc_source_snapshot!.execute(
      { sourceId: "source-requirements", sourcePath },
      { sessionID: "session-1" } as never,
    );

    const page = JSON.parse(await hooks.tool!.sdlc_source_read!.execute(
      { sourceId: "source-requirements", offset: 2, limit: 4 },
      { sessionID: "session-1" } as never,
    ) as string);

    expect(page).toMatchObject({ content: "2345", offset: 2, nextOffset: 6, complete: false });
  });

  it("把授权素材目录作为一个来源登记、按条目读取并精确复制", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    const sourceRoot = await mkdtemp(path.join(tmpdir(), "sdlc-source-"));
    temporaryDirectories.push(directory, sourceRoot);
    await mkdir(path.join(sourceRoot, "prototype", "assets"), { recursive: true });
    await writeFile(path.join(sourceRoot, "prototype", "index.html"), "<main>原型</main>\n", "utf8");
    await writeFile(path.join(sourceRoot, "prototype", "assets", "icon.png"), Buffer.from([1, 2, 3]));
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks.tool!.sdlc_init!.execute(
      { projectName: "测试项目", allowedReadRoots: [sourceRoot], allowedExecutables: ["node"] },
      { sessionID: "session-directory-source" } as never,
    );
    await hooks["command.execute.before"]!({
      command: "sdlc-spec", sessionID: "session-directory-source", arguments: "",
    }, { parts: [] } as never);

    const listing = JSON.parse(await hooks.tool!.sdlc_source_list!.execute(
      { rootIndex: 0, relativePath: "prototype", recursive: true, maxEntries: 20 },
      { sessionID: "session-directory-source" } as never,
    ) as string);
    await hooks.tool!.sdlc_source_snapshot!.execute(
      { sourceId: "source-prototype", sourcePath: path.join(sourceRoot, "prototype") },
      { sessionID: "session-directory-source" } as never,
    );
    const page = JSON.parse(await hooks.tool!.sdlc_source_read!.execute(
      { sourceId: "source-prototype", entryPath: "index.html", offset: 0, limit: 12000 },
      { sessionID: "session-directory-source" } as never,
    ) as string);
    const materialized = JSON.parse(await hooks.tool!.sdlc_source_materialize!.execute(
      { sourceId: "source-prototype", targetPath: "assets/prototype" },
      { sessionID: "session-directory-source" } as never,
    ) as string);

    expect(listing.entries).toHaveLength(3);
    expect(page).toMatchObject({ entryPath: "index.html", content: "<main>原型</main>\n", complete: true });
    expect(materialized.fileCount).toBe(2);
    await expect(readFile(path.join(directory, "assets", "prototype", "assets", "icon.png")))
      .resolves.toEqual(Buffer.from([1, 2, 3]));
  });

  it("生命周期文档只允许写入 docs 下的 Markdown 或 YAML", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks["command.execute.before"]!({
      command: "sdlc-spec", sessionID: "session-1", arguments: "",
    }, { parts: [] } as never);

    await hooks.tool!.sdlc_document_write!.execute(
      { targetPath: "docs/requirements/requirement-set.yaml", content: "schemaVersion: 1\n" },
      { sessionID: "session-1" } as never,
    );
    await expect(readFile(path.join(directory, "docs", "requirements", "requirement-set.yaml"), "utf8"))
      .resolves.toBe("schemaVersion: 1\n");
    await expect(hooks.tool!.sdlc_document_write!.execute(
      { targetPath: "src/app.ts", content: "越权" },
      { sessionID: "session-1" } as never,
    )).rejects.toThrow("docs 目录");
  });

  it("插件重启后从项目日志恢复当前会话进入的生命周期命令", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const firstHooks = await SdlcFactoryPlugin({ directory } as never);
    await firstHooks.tool!.sdlc_init!.execute(
      { projectName: "测试项目", allowedReadRoots: [], allowedExecutables: ["node"] },
      { sessionID: "session-recovered" } as never,
    );
    await firstHooks["command.execute.before"]!({
      command: "sdlc-spec", sessionID: "session-recovered", arguments: "",
    }, { parts: [] } as never);

    const restartedHooks = await SdlcFactoryPlugin({ directory } as never);
    await restartedHooks.tool!.sdlc_document_write!.execute(
      { targetPath: "docs/requirements/recovered.md", content: "# 已恢复\n" },
      { sessionID: "session-recovered" } as never,
    );

    await expect(readFile(path.join(directory, "docs", "requirements", "recovered.md"), "utf8"))
      .resolves.toBe("# 已恢复\n");
  });

  it("通过工具创建产品概述候选后状态进入等待审核", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    await mkdir(path.join(directory, "docs", "requirements"), { recursive: true });
    await writeFile(path.join(directory, "docs", "requirements", "product-brief.md"), [
      "# 产品概述", "## 产品目标", "## 系统边界", "## 主要角色", "## 业务模块", "## 未知", "",
    ].join("\n"), "utf8");
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks.tool!.sdlc_init!.execute(
      { projectName: "测试项目", allowedReadRoots: [], allowedExecutables: ["node"] },
      { sessionID: "session-1" } as never,
    );
    await expect(hooks.tool!.sdlc_candidate_create!.execute({
      kind: "PRODUCT_BRIEF",
      scopeType: "PROJECT",
      scopeId: "project",
      scopeName: "项目",
      subjectPaths: ["docs/requirements/product-brief.md"],
      inputVersionIds: [],
      sourceIds: [],
      testRecordIds: [],
      changeType: "STRUCTURE",
      changeSummary: "建立产品概述",
      proposedImpactScopeIds: [],
    }, { sessionID: "session-without-command" } as never)).rejects.toThrow("必须通过 /sdlc-spec");
    await hooks["command.execute.before"]!({
      command: "sdlc-spec", sessionID: "session-1", arguments: "",
    }, { parts: [] } as never);

    const candidate = JSON.parse(await hooks.tool!.sdlc_candidate_create!.execute({
      kind: "PRODUCT_BRIEF",
      scopeType: "PROJECT",
      scopeId: "project",
      scopeName: "项目",
      subjectPaths: ["docs/requirements/product-brief.md"],
      inputVersionIds: [],
      sourceIds: [],
      testRecordIds: [],
      changeType: "STRUCTURE",
      changeSummary: "建立产品概述",
      proposedImpactScopeIds: [],
    }, { sessionID: "session-1" } as never) as string);
    const status = JSON.parse(await hooks.tool!.sdlc_status!.execute({}, { sessionID: "session-1" } as never) as string);

    expect(candidate.kind).toBe("PRODUCT_BRIEF");
    expect(status.pendingCandidates[0]).toMatchObject({ candidateId: candidate.candidateId, reviewState: "PENDING" });
    expect(status.recommendedAction.command).toBe("/sdlc-review");

    const reviewProjection = JSON.parse(await hooks.tool!.sdlc_candidate_read!.execute(
      { candidateId: candidate.candidateId },
      { sessionID: "session-1" } as never,
    ) as string);
    expect(reviewProjection).toMatchObject({
      candidateId: candidate.candidateId,
      contentHash: candidate.contentHash,
      revision: 1,
      subjects: [{ path: "docs/requirements/product-brief.md" }],
      changeSummary: "建立产品概述",
    });
    expect(JSON.stringify(reviewProjection)).not.toContain("snapshotPath");
  });

  it("审核命令只能通过候选投影读取详情", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks["command.execute.before"]!({
      command: "sdlc-review", sessionID: "session-review", arguments: "",
    }, { parts: [] } as never);

    await expect(hooks["tool.execute.before"]!({
      tool: "grep", sessionID: "session-review", callID: "call-1",
    }, { args: { path: directory, pattern: "candidate" } })).rejects.toThrow("禁止扫描或直接读取工作区");
  });

  it("测试命令禁止原生写入和 shell，受控测试工具仍可使用", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks["command.execute.before"]!({
      command: "sdlc-test", sessionID: "session-test-boundary", arguments: "系统",
    }, { parts: [] } as never);

    for (const tool of ["write", "edit", "apply_patch", "bash", "shell"]) {
      await expect(hooks["tool.execute.before"]!({
        tool, sessionID: "session-test-boundary", callID: `call-${tool}`,
      }, { args: {} })).rejects.toThrow("测试阶段禁止使用原生写入或 shell 工具");
    }
    await expect(hooks["tool.execute.before"]!({
      tool: "sdlc_command_execute", sessionID: "session-test-boundary", callID: "call-controlled",
    }, { args: {} })).resolves.toBeUndefined();
  });

  it("测试候选审核投影包含环境边界和受控命令摘要", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const store = new ProjectStore(directory);
    const environment: EnvironmentVersion = {
      environmentVersionId: "environment-system-simulation-r1",
      environmentId: "system-simulation",
      name: "系统模拟环境",
      purpose: "只验证本地闭环，不代表真实设备验收",
      revision: 1,
      applicationUrl: "app://test",
      readinessUrl: "app://test",
      externalInterfaces: [{ interfaceId: "device-api", address: "https://device.invalid.test" }],
      dependencies: [],
      credentialReferences: [],
      effectiveFrom: "2026-08-13T00:00:00.000Z",
      contentHash: "e".repeat(64),
      createdBySessionId: "session-test",
      createdAt: "2026-08-13T00:00:00.000Z",
    };
    const evidence: CommandEvidence = {
      evidenceId: "evidence-system",
      runId: "run-system",
      executable: "pnpm",
      arguments: ["verify:contracts", "--password=top-secret"],
      workingDirectory: ".",
      exitCode: 0,
      timedOut: false,
      startedAt: "2026-08-13T00:00:01.000Z",
      finishedAt: "2026-08-13T00:00:02.000Z",
      durationMs: 1000,
      stdoutPath: ".sdlc-factory/evidence/stdout.log",
      stdoutHash: "o".repeat(64),
      stderrPath: ".sdlc-factory/evidence/stderr.log",
      stderrHash: "s".repeat(64),
    };
    const record: TestRecord = {
      testRecordId: "test-record-system",
      scope: { type: "SYSTEM", id: "system", name: "系统" },
      runId: "run-system",
      outcome: "PASSED",
      inputVersionIds: ["design-set-project-r1"],
      environmentVersionId: environment.environmentVersionId,
      environmentHash: environment.contentHash,
      resolvedAddresses: ["app://test", "https://device.invalid.test"],
      commandEvidenceIds: [evidence.evidenceId],
      passedCommands: 1,
      failedCommands: 0,
      skippedCommands: 0,
      blockedCommands: 0,
      assertionCountsAvailable: false,
      evidencePaths: [],
      fingerprint: "f".repeat(64),
      startedAt: evidence.startedAt,
      finishedAt: evidence.finishedAt,
      createdAt: evidence.finishedAt,
    };
    const candidate: Candidate = {
      candidateId: "candidate-system-test",
      kind: "SYSTEM_TEST",
      scope: record.scope,
      revision: 1,
      contentHash: "c".repeat(64),
      subjectPaths: ["docs/verification/verification-report.md"],
      subjects: [{
        path: "docs/verification/verification-report.md",
        sha256: "r".repeat(64),
        size: 100,
        snapshotPath: ".sdlc-factory/objects/report",
      }],
      inputVersionIds: record.inputVersionIds,
      sourceIds: [],
      testRecordIds: [record.testRecordId],
      changeType: "BEHAVIOR",
      changeSummary: "形成系统测试报告",
      proposedImpactScopeIds: [],
      deterministicChecks: [],
      createdBySessionId: "session-test",
      createdAt: evidence.finishedAt,
    };
    await store.writeImmutable("environments", environment.environmentVersionId, environment);
    await store.writeImmutable("command-evidence", evidence.evidenceId, evidence);
    await store.writeImmutable("test-runs", record.testRecordId, record);
    await store.writeImmutable("candidates", candidate.candidateId, candidate);

    const hooks = await SdlcFactoryPlugin({ directory } as never);
    const projection = JSON.parse(await hooks.tool!.sdlc_candidate_read!.execute(
      { candidateId: candidate.candidateId },
      { sessionID: "session-test" } as never,
    ) as string);

    expect(projection.testRecords[0]).toMatchObject({
      testRecordId: record.testRecordId,
      outcome: "PASSED",
      resolvedAddresses: ["app://test", "https://device.invalid.test"],
      environment: {
        environmentVersionId: environment.environmentVersionId,
        purpose: "只验证本地闭环，不代表真实设备验收",
      },
      commands: [{
        evidenceId: evidence.evidenceId,
        executable: "pnpm",
        arguments: ["verify:contracts", "--password=[REDACTED]"],
        exitCode: 0,
      }],
    });
    expect(JSON.stringify(projection)).not.toContain(evidence.stdoutPath);
    expect(JSON.stringify(projection)).not.toContain("top-secret");
    expect(JSON.stringify(projection)).not.toContain("credentialReferences");
  });

  it("需求命令不能扫描工作区或直接读取插件内部状态", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks["command.execute.before"]!({
      command: "sdlc-spec", sessionID: "session-spec", arguments: "",
    }, { parts: [] } as never);

    await expect(hooks["tool.execute.before"]!({
      tool: "glob", sessionID: "session-spec", callID: "call-1",
    }, { args: { path: directory, pattern: "**/*" } })).rejects.toThrow("禁止扫描工作区");
    await expect(hooks["tool.execute.before"]!({
      tool: "read", sessionID: "session-spec", callID: "call-2",
    }, { args: { filePath: path.join(directory, ".sdlc-factory", "manifest.json") } }))
      .rejects.toThrow("内部状态目录");
  });

  it("编码命令在建立运行记录前阻止修改和命令执行", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks["command.execute.before"]!({
      command: "sdlc-code", sessionID: "session-code", arguments: "系统管理",
    }, { parts: [] } as never);

    await expect(hooks["tool.execute.before"]!({
      tool: "edit", sessionID: "session-code", callID: "call-1",
    }, { args: { filePath: path.join(directory, "src", "app.ts") } }))
      .rejects.toThrow("先通过 sdlc_run_start");
  });
});
