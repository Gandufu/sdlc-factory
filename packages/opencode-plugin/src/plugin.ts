import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { tool, type Plugin } from "@opencode-ai/plugin";

import { findModule, findRequirementMap, isModuleDesignFacts } from "./artifact-validator.js";
import { CandidateService, currentVersion } from "./candidate-service.js";
import { ContextService } from "./context-service.js";
import { ControlledExecutionService } from "./controlled-execution.js";
import { writeLifecycleDocument } from "./document-service.js";
import type {
  ApprovedVersion,
  ArtifactKind,
  ArtifactScope,
  Candidate,
  CandidateFacts,
  EnvironmentVersion,
  ProjectManifest,
  RunRecord,
} from "./domain.js";
import { EnvironmentService } from "./environment-service.js";
import { readGitBase } from "./git-service.js";
import { sha256 } from "./hash.js";
import { ProjectStore } from "./project-store.js";
import { ReviewService } from "./review-service.js";
import { RunService } from "./run-service.js";
import { SetService } from "./set-service.js";
import { SourceService } from "./source-service.js";
import { findModuleByExactName, StatusService } from "./status-service.js";
import { TestRecordService, VerificationReportService } from "./test-record-service.js";
import { resolveWorkspacePath } from "./workspace-path.js";

const PLUGIN_VERSION = "0.1.0";
const DEFAULT_EXECUTABLES = ["node", "corepack", "pnpm", "npm", "npx", "mvn", "mvnw", "gradle", "gradlew", "java", "playwright"];

export const SdlcFactoryPlugin: Plugin = async ({ client, directory }) => {
  const runtime = { id: randomUUID, now: () => new Date().toISOString() };
  const store = () => new ProjectStore(directory);
  const sessionMessages = {
    async latestUserText(sessionId: string): Promise<string> {
      const response = await client.session.messages({ path: { id: sessionId }, query: { directory } });
      const latest = [...(response.data ?? [])].reverse().find((message) => message.info.role === "user");
      if (!latest) throw new Error(`当前会话没有用户消息: ${sessionId}`);
      return latest.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
    },
  };
  const sessionCommands = new Map<string, string>();

  const moduleSchema = tool.schema.object({
    moduleId: tool.schema.string().min(2),
    name: tool.schema.string().min(1),
    slug: tool.schema.string().min(1),
    goal: tool.schema.string().min(1),
    functionalGroups: tool.schema.array(tool.schema.string().min(1)).min(1),
    dependencies: tool.schema.array(tool.schema.string().min(1)).default([]),
    interfaceIds: tool.schema.array(tool.schema.string().min(1)).default([]),
    qualityIds: tool.schema.array(tool.schema.string().min(1)).default([]),
    status: tool.schema.enum(["ACTIVE", "RETIRED"]).default("ACTIVE"),
    derivedFromModuleIds: tool.schema.array(tool.schema.string().min(1)).default([]),
  });
  const interfaceSchema = tool.schema.object({
    interfaceId: tool.schema.string().min(2),
    name: tool.schema.string().min(1),
    slug: tool.schema.string().min(1),
    scopeModuleIds: tool.schema.array(tool.schema.string().min(1)).min(1),
  });
  const qualitySchema = tool.schema.object({
    qualityId: tool.schema.string().min(2),
    name: tool.schema.string().min(1),
    slug: tool.schema.string().min(1),
    scope: tool.schema.enum(["GLOBAL", "MODULES"]),
    scopeModuleIds: tool.schema.array(tool.schema.string().min(1)).default([]),
  });

  return {
    event: async ({ event }) => {
      if (event.type !== "todo.updated") return;
      const properties = event.properties as {
        sessionID: string;
        todos: Array<{ id: string; content: string; status: string; priority: string }>;
      };
      await new RunService(store(), runtime).captureTodo(properties.sessionID, properties.todos);
    },
    "command.execute.before": async (input) => {
      sessionCommands.set(input.sessionID, input.command);
    },
    "tool.execute.before": async (input, output) => {
      const service = new RunService(store(), runtime);
      const command = sessionCommands.get(input.sessionID);
      enforceReadBoundary(directory, command, input.tool, output.args);
      if (command === "sdlc-code" && isMutatingTool(input.tool)) {
        await service.requireActiveCodingRun(input.sessionID);
      }
      if (input.tool.toLowerCase() === "todowrite") {
        if (command === "sdlc-code") await service.requireActiveCodingRun(input.sessionID);
        await service.recordTodoInvocation(input.sessionID);
      }
      await service.assertToolAllowed(input.sessionID, input.tool);
    },
    tool: {
      sdlc_init: tool({
        description: "Initialize versioned SDLC project facts without creating a project plan.",
        args: {
          projectName: tool.schema.string().min(1),
          allowedReadRoots: tool.schema.array(tool.schema.string()).default([]),
          allowedExecutables: tool.schema.array(tool.schema.string().min(1)).default(DEFAULT_EXECUTABLES),
        },
        async execute(args, context) {
          const projectStore = store();
          const manifest: ProjectManifest = {
            schemaVersion: 2,
            pluginVersion: PLUGIN_VERSION,
            projectName: args.projectName,
            workspaceRoot: directory,
            allowedReadRoots: args.allowedReadRoots ?? [],
            allowedExecutables: [...new Set(args.allowedExecutables ?? DEFAULT_EXECUTABLES)],
            initializedBySessionId: context.sessionID,
            initializedAt: runtime.now(),
          };
          await projectStore.writeManifest(manifest);
          await projectStore.appendJournal({
            type: "PROJECT_INITIALIZED",
            at: manifest.initializedAt,
            sessionId: context.sessionID,
            projectName: args.projectName,
            schemaVersion: manifest.schemaVersion,
          });
          return JSON.stringify({ initialized: true, schemaVersion: 2, projectName: args.projectName });
        },
      }),
      sdlc_source_snapshot: tool({
        description: "Snapshot an explicitly authorized source into immutable project facts.",
        args: { sourceId: tool.schema.string().min(1), sourcePath: tool.schema.string().min(1) },
        async execute(args) {
          const projectStore = store();
          const manifest = await projectStore.readManifest<ProjectManifest>();
          return JSON.stringify(await new SourceService(projectStore, directory, manifest.allowedReadRoots)
            .snapshot(args.sourceId, args.sourcePath));
        },
      }),
      sdlc_source_read: tool({
        description: "Read one bounded page from an immutable source snapshot.",
        args: {
          sourceId: tool.schema.string().min(1),
          offset: tool.schema.number().int().nonnegative().default(0),
          limit: tool.schema.number().int().min(1).max(12000).default(12000),
        },
        async execute(args) {
          const snapshot = await store().readJson<{
            sourceId: string; originalPath: string; snapshotPath: string; sha256: string;
          }>("sources", args.sourceId);
          const text = await readFile(snapshot.snapshotPath, "utf8");
          const offset = args.offset ?? 0;
          const limit = args.limit ?? 12000;
          const nextOffset = Math.min(offset + limit, text.length);
          return JSON.stringify({
            sourceId: snapshot.sourceId,
            originalPath: snapshot.originalPath,
            sha256: snapshot.sha256,
            content: text.slice(offset, nextOffset),
            offset,
            nextOffset,
            totalLength: text.length,
            complete: nextOffset >= text.length,
          });
        },
      }),
      sdlc_source_materialize: tool({
        description: "Copy exact immutable source bytes into a bounded workspace path.",
        args: { sourceId: tool.schema.string().min(1), targetPath: tool.schema.string().min(1) },
        async execute(args) {
          const snapshot = await store().readJson<{ sourceId: string; snapshotPath: string; sha256: string }>("sources", args.sourceId);
          const target = await resolveWorkspacePath(directory, args.targetPath);
          await mkdir(path.dirname(target), { recursive: true });
          await copyFile(snapshot.snapshotPath, target);
          const actualHash = sha256(await readFile(target));
          if (actualHash !== snapshot.sha256) throw new Error(`来源复制哈希不一致: ${args.sourceId}`);
          return JSON.stringify({ sourceId: args.sourceId, targetPath: args.targetPath, sha256: actualHash });
        },
      }),
      sdlc_document_write: tool({
        description: "Atomically write a Markdown or YAML lifecycle document inside docs.",
        args: { targetPath: tool.schema.string().min(1), content: tool.schema.string() },
        async execute(args) {
          return JSON.stringify(await writeLifecycleDocument(directory, args.targetPath, args.content));
        },
      }),
      sdlc_status: tool({
        description: "Derive the latest read-only project progress from immutable lifecycle facts.",
        args: {},
        async execute() {
          if (!existsSync(path.join(directory, ".sdlc-factory", "manifest.json"))) {
            return JSON.stringify({
              initialized: false,
              recommendedAction: { action: "INIT", todo: "执行 /sdlc-init", command: "/sdlc-init", reason: "项目尚未初始化" },
            });
          }
          return JSON.stringify(await new StatusService(store()).read());
        },
      }),
      sdlc_context_assemble: tool({
        description: "Assemble bounded, versioned minimum context for one lifecycle workflow and business module.",
        args: {
          workflow: tool.schema.enum(["SPEC", "DESIGN", "CODE", "MODULE_TEST", "SYSTEM_TEST"]),
          moduleName: tool.schema.string().min(1).optional(),
          maxTotalCharacters: tool.schema.number().int().min(4000).max(60000).default(30000),
        },
        async execute(args) {
          return JSON.stringify(await new ContextService(store()).assemble(
            args.workflow,
            args.moduleName,
            args.maxTotalCharacters ?? 30000,
          ));
        },
      }),
      sdlc_candidate_create: tool({
        description: "Create an immutable version candidate for one project, module, interface, quality or system artifact.",
        args: {
          kind: tool.schema.enum([
            "PRODUCT_BRIEF", "REQUIREMENT_MAP", "MODULE_REQUIREMENT", "INTERFACE_REQUIREMENT",
            "QUALITY_REQUIREMENT", "PRODUCT_ARCHITECTURE", "MODULE_DESIGN", "INTERFACE_DESIGN",
            "CODE", "MODULE_TEST", "SYSTEM_TEST", "SYSTEM_ACCEPTANCE",
          ]),
          scopeType: tool.schema.enum(["PROJECT", "MODULE", "INTERFACE", "QUALITY", "SYSTEM"]),
          scopeId: tool.schema.string().min(1),
          scopeName: tool.schema.string().min(1),
          subjectPaths: tool.schema.array(tool.schema.string().min(1)).default([]),
          parentVersionId: tool.schema.string().min(1).optional(),
          inputVersionIds: tool.schema.array(tool.schema.string().min(1)).default([]),
          sourceIds: tool.schema.array(tool.schema.string().min(1)).default([]),
          testRecordIds: tool.schema.array(tool.schema.string().min(1)).default([]),
          changeType: tool.schema.enum(["EDITORIAL", "CLARIFICATION", "BEHAVIOR", "STRUCTURE"]),
          changeSummary: tool.schema.string().min(1),
          proposedImpactScopeIds: tool.schema.array(tool.schema.string().min(1)).default([]),
          businessModules: tool.schema.array(moduleSchema).optional(),
          interfaces: tool.schema.array(interfaceSchema).optional(),
          qualityRequirements: tool.schema.array(qualitySchema).optional(),
          productPaths: tool.schema.array(tool.schema.string().min(1)).optional(),
          testPaths: tool.schema.array(tool.schema.string().min(1)).optional(),
          runId: tool.schema.string().min(1).optional(),
          gitBase: tool.schema.string().min(1).optional(),
        },
        async execute(args, context) {
          const kind = args.kind as ArtifactKind;
          let facts: CandidateFacts | undefined;
          if (kind === "REQUIREMENT_MAP") {
            facts = {
              businessModules: (args.businessModules ?? []).map((module) => ({
                ...module,
                dependencies: module.dependencies ?? [],
                interfaceIds: module.interfaceIds ?? [],
                qualityIds: module.qualityIds ?? [],
                status: module.status ?? "ACTIVE",
                ...(module.derivedFromModuleIds?.length ? { derivedFromModuleIds: module.derivedFromModuleIds } : {}),
              })),
              interfaces: args.interfaces ?? [],
              qualityRequirements: (args.qualityRequirements ?? []).map((quality) => ({
                ...quality,
                scopeModuleIds: quality.scopeModuleIds ?? [],
              })),
            };
          } else if (kind === "MODULE_DESIGN") {
            facts = { productPaths: args.productPaths ?? [], testPaths: args.testPaths ?? [] };
          }
          const inputVersionIds = args.inputVersionIds ?? [];
          const testRecordIds = args.testRecordIds ?? [];
          const provenance = args.runId && args.gitBase
            ? { runId: args.runId, gitBase: args.gitBase, inputVersionIds, testRecordIds }
            : undefined;
          const candidate = await new CandidateService(store(), directory, runtime).create({
            kind,
            scope: { type: args.scopeType, id: args.scopeId, name: args.scopeName },
            subjectPaths: args.subjectPaths ?? [],
            ...(args.parentVersionId ? { parentVersionId: args.parentVersionId } : {}),
            inputVersionIds,
            sourceIds: args.sourceIds ?? [],
            testRecordIds,
            changeType: args.changeType,
            changeSummary: args.changeSummary,
            proposedImpactScopeIds: args.proposedImpactScopeIds ?? [],
            ...(facts ? { facts } : {}),
            ...(provenance ? { provenance } : {}),
            createdBySessionId: context.sessionID,
          });
          const reviewCommand = args.scopeType === "PROJECT" || args.scopeType === "SYSTEM"
            ? "/sdlc-review"
            : `/sdlc-review ${args.scopeName}`;
          return JSON.stringify({
            ...candidate,
            recommendedAction: {
              action: "REVIEW",
              command: reviewCommand,
              todo: `执行 ${reviewCommand}`,
              reason: "候选已经固定，等待用户直接审核",
            },
          });
        },
      }),
      sdlc_candidate_read: tool({
        description: "Read the safe, immutable review projection for one candidate without exposing internal paths.",
        args: { candidateId: tool.schema.string().min(1) },
        async execute(args) {
          const candidate = await store().readJson<Candidate>("candidates", args.candidateId);
          return JSON.stringify({
            candidateId: candidate.candidateId,
            contentHash: candidate.contentHash,
            kind: candidate.kind,
            scope: candidate.scope,
            revision: candidate.revision,
            ...(candidate.parentVersionId ? { parentVersionId: candidate.parentVersionId } : {}),
            inputVersionIds: candidate.inputVersionIds,
            sourceIds: candidate.sourceIds,
            testRecordIds: candidate.testRecordIds,
            subjects: candidate.subjects.map(({ path: subjectPath, sha256: subjectHash, size }) => ({
              path: subjectPath,
              sha256: subjectHash,
              size,
            })),
            deterministicChecks: candidate.deterministicChecks,
            changeType: candidate.changeType,
            changeSummary: candidate.changeSummary,
            proposedImpactScopeIds: candidate.proposedImpactScopeIds,
            createdAt: candidate.createdAt,
          });
        },
      }),
      sdlc_set_candidate_create: tool({
        description: "Generate an exact requirement or design version-set projection and immutable candidate.",
        args: {
          kind: tool.schema.enum(["REQUIREMENT_SET", "DESIGN_SET"]),
          changeType: tool.schema.enum(["EDITORIAL", "CLARIFICATION", "BEHAVIOR", "STRUCTURE"]),
          changeSummary: tool.schema.string().min(1),
          proposedImpactScopeIds: tool.schema.array(tool.schema.string().min(1)).default([]),
        },
        async execute(args, context) {
          const candidate = await new SetService(store(), directory, runtime).create({
            kind: args.kind,
            changeType: args.changeType,
            changeSummary: args.changeSummary,
            proposedImpactScopeIds: args.proposedImpactScopeIds ?? [],
            sessionId: context.sessionID,
          });
          return JSON.stringify({
            ...candidate,
            recommendedAction: {
              action: "REVIEW",
              command: "/sdlc-review",
              todo: "执行 /sdlc-review",
              reason: "版本集合候选已经固定，等待用户直接审核",
            },
          });
        },
      }),
      sdlc_review_apply: tool({
        description: "Apply a review only when arguments exactly match the current session user's direct message.",
        args: {
          candidateId: tool.schema.string().min(1),
          candidateHash: tool.schema.string().regex(/^[a-f0-9]{64}$/u),
          decision: tool.schema.enum(["APPROVE", "REVISE", "HOLD"]),
        },
        async execute(args, context) {
          return JSON.stringify(await new ReviewService(store(), directory, sessionMessages, runtime)
            .apply(context.sessionID, args));
        },
      }),
      sdlc_environment_register: tool({
        description: "Register an immutable environment version with actual addresses and credential references only.",
        args: {
          environmentId: tool.schema.string().min(2),
          name: tool.schema.string().min(1),
          purpose: tool.schema.string().min(1),
          parentVersionId: tool.schema.string().min(1).optional(),
          applicationUrl: tool.schema.string().min(1).optional(),
          readinessUrl: tool.schema.string().min(1).optional(),
          externalInterfaces: tool.schema.array(tool.schema.object({
            interfaceId: tool.schema.string().min(1), address: tool.schema.string().min(1),
          })).default([]),
          dependencies: tool.schema.array(tool.schema.object({
            name: tool.schema.string().min(1), address: tool.schema.string().min(1), version: tool.schema.string().optional(),
          })).default([]),
          credentialReferences: tool.schema.array(tool.schema.string().min(1)).default([]),
          effectiveFrom: tool.schema.string().min(1),
        },
        async execute(args, context) {
          return JSON.stringify(await new EnvironmentService(store(), runtime).register({
            environmentId: args.environmentId,
            name: args.name,
            purpose: args.purpose,
            ...(args.parentVersionId ? { parentVersionId: args.parentVersionId } : {}),
            ...(args.applicationUrl ? { applicationUrl: args.applicationUrl } : {}),
            ...(args.readinessUrl ? { readinessUrl: args.readinessUrl } : {}),
            externalInterfaces: args.externalInterfaces ?? [],
            dependencies: (args.dependencies ?? []).map((dependency) => ({
              name: dependency.name,
              address: dependency.address,
              ...(dependency.version ? { version: dependency.version } : {}),
            })),
            credentialReferences: args.credentialReferences ?? [],
            effectiveFrom: args.effectiveFrom,
          }, context.sessionID));
        },
      }),
      sdlc_run_start: tool({
        description: "Start one gated business-module coding/test run or one system-test run without an execution plan.",
        args: {
          command: tool.schema.string().min(1),
          moduleName: tool.schema.string().min(1).optional(),
        },
        async execute(args, context) {
          const projectStore = store();
          const status = await new StatusService(projectStore).read();
          const versions = await projectStore.listJson<ApprovedVersion>("approved-versions");
          const map = findRequirementMap(versions);
          const gitBase = await readGitBase(directory);
          if (!status.designSetVersionId || !map) throw new Error("总设计版本批准并有效后才能开始编码或测试运行");
          let runInput: Omit<RunRecord, "runId" | "createdAt">;
          if (args.command === "/sdlc-test system") {
            if (args.moduleName && args.moduleName !== "system") throw new Error("系统测试不能指定业务模块名称");
            const incomplete = status.modules?.filter((module) => !module.moduleTestVersionId || module.moduleTestResult !== "PASSED") ?? [];
            if (incomplete.length > 0) throw new Error(`以下业务模块尚无当前通过的模块测试: ${incomplete.map((item) => item.moduleName).join("、")}`);
            const inputVersionIds = [status.designSetVersionId];
            for (const module of status.modules ?? []) {
              inputVersionIds.push(module.codeVersionId!, module.moduleTestVersionId!);
            }
            runInput = {
              command: args.command,
              commandType: "SYSTEM_TEST",
              sessionId: context.sessionID,
              scope: { type: "SYSTEM", id: "system", name: "系统" },
              gitBase,
              inputVersionIds,
              allowedProductPaths: [],
              allowedTestPaths: map.businessModules.flatMap((module) => {
                const design = currentVersion(versions, "MODULE_DESIGN", module.moduleId);
                return isModuleDesignFacts(design?.facts) ? design.facts.testPaths : [];
              }),
            };
          } else {
            if (!args.moduleName) throw new Error("业务模块运行必须提供完整模块名称");
            const moduleProgress = findModuleByExactName(status, args.moduleName);
            const module = findModule(versions, moduleProgress.moduleId)!;
            const codeCommand = `/sdlc-code ${module.name}`;
            const testCommand = `/sdlc-test ${module.name}`;
            if (args.command !== codeCommand && args.command !== testCommand) {
              throw new Error(`运行命令必须包含完整业务模块名称: ${codeCommand} 或 ${testCommand}`);
            }
            const isCode = args.command === codeCommand;
            if (isCode && (moduleProgress.stage !== "CODING" || ["BLOCKED", "WAITING_REVIEW", "SUSPENDED"].includes(moduleProgress.state))) {
              throw new Error(`业务模块当前不能进入编码: ${moduleProgress.state}/${moduleProgress.stage}`);
            }
            if (!isCode && (moduleProgress.stage !== "MODULE_TEST" || ["WAITING_REVIEW", "SUSPENDED"].includes(moduleProgress.state))) {
              throw new Error(`业务模块当前不能进入模块测试: ${moduleProgress.state}/${moduleProgress.stage}`);
            }
            const design = currentVersion(versions, "MODULE_DESIGN", module.moduleId)!;
            if (!isModuleDesignFacts(design.facts)) throw new Error(`模块设计缺少实现路径边界: ${design.versionId}`);
            const inputVersionIds = isCode
              ? [status.requirementSetVersionId!, status.designSetVersionId!, moduleProgress.requirementVersionId!, design.versionId]
              : [status.designSetVersionId!, design.versionId, moduleProgress.codeVersionId!];
            runInput = {
              command: args.command,
              commandType: isCode ? "CODE" : "MODULE_TEST",
              sessionId: context.sessionID,
              scope: { type: "MODULE", id: module.moduleId, name: module.name },
              gitBase,
              inputVersionIds,
              allowedProductPaths: design.facts.productPaths,
              allowedTestPaths: design.facts.testPaths,
            };
          }
          return JSON.stringify(await new RunService(projectStore, runtime).start(runInput));
        },
      }),
      sdlc_command_execute: tool({
        description: "Execute one allowlisted command without shell composition and capture immutable redacted evidence.",
        args: {
          runId: tool.schema.string().min(1),
          executable: tool.schema.string().min(1),
          arguments: tool.schema.array(tool.schema.string()).default([]),
          workingDirectory: tool.schema.string().min(1).default("."),
          timeoutMs: tool.schema.number().int().min(1000).max(1800000).default(300000),
        },
        async execute(args, context) {
          const projectStore = store();
          const run = await projectStore.readJson<RunRecord>("runs", args.runId);
          if (run.sessionId !== context.sessionID) throw new Error("只能在创建运行的同一会话中执行命令");
          await new RunService(projectStore, runtime).assertToolAllowed(context.sessionID, "bash");
          return JSON.stringify(await new ControlledExecutionService(projectStore, directory, runtime).execute({
            runId: args.runId,
            executable: args.executable,
            arguments: args.arguments ?? [],
            workingDirectory: args.workingDirectory ?? ".",
            timeoutMs: args.timeoutMs ?? 300000,
          }));
        },
      }),
      sdlc_run_finish: tool({
        description: "Finish a run while preserving failures and enforcing coding Todo evidence.",
        args: {
          runId: tool.schema.string().min(1),
          state: tool.schema.enum(["SUCCEEDED", "FAILED", "BLOCKED"]),
        },
        async execute(args) {
          return JSON.stringify(await new RunService(store(), runtime).finish(args.runId, args.state));
        },
      }),
      sdlc_test_record_create: tool({
        description: "Create an immutable test record from a finished run and exact environment/file fingerprints.",
        args: {
          runId: tool.schema.string().min(1),
          scopeType: tool.schema.enum(["MODULE", "SYSTEM"]),
          scopeId: tool.schema.string().min(1),
          scopeName: tool.schema.string().min(1),
          environmentVersionId: tool.schema.string().min(1).optional(),
          fingerprintPaths: tool.schema.array(tool.schema.string().min(1)).default([]),
          evidencePaths: tool.schema.array(tool.schema.string().min(1)).default([]),
        },
        async execute(args) {
          return JSON.stringify(await new TestRecordService(store(), directory, runtime).create({
            runId: args.runId,
            scope: { type: args.scopeType, id: args.scopeId, name: args.scopeName },
            ...(args.environmentVersionId ? { environmentVersionId: args.environmentVersionId } : {}),
            fingerprintPaths: args.fingerprintPaths ?? [],
            evidencePaths: args.evidencePaths ?? [],
          }));
        },
      }),
      sdlc_test_reuse_find: tool({
        description: "Find a reusable passed test record only when the complete input fingerprint matches.",
        args: {
          scopeType: tool.schema.enum(["MODULE", "SYSTEM"]),
          scopeId: tool.schema.string().min(1),
          scopeName: tool.schema.string().min(1),
          inputVersionIds: tool.schema.array(tool.schema.string().min(1)).min(1),
          environmentVersionId: tool.schema.string().min(1).optional(),
          fingerprintPaths: tool.schema.array(tool.schema.string().min(1)).default([]),
          commands: tool.schema.array(tool.schema.object({
            executable: tool.schema.string().min(1),
            arguments: tool.schema.array(tool.schema.string()).default([]),
            workingDirectory: tool.schema.string().min(1).default("."),
          })).min(1),
        },
        async execute(args) {
          const record = await new TestRecordService(store(), directory, runtime).findReusable(
            { type: args.scopeType, id: args.scopeId, name: args.scopeName },
            args.inputVersionIds,
            args.environmentVersionId,
            args.fingerprintPaths ?? [],
            args.commands.map((command) => ({
              executable: command.executable,
              arguments: command.arguments ?? [],
              workingDirectory: command.workingDirectory ?? ".",
            })),
          );
          return JSON.stringify({ reusable: Boolean(record), ...(record ? { testRecord: record } : {}) });
        },
      }),
      sdlc_verification_report_generate: tool({
        description: "Generate the user-readable verification report only from immutable test records.",
        args: { testRecordIds: tool.schema.array(tool.schema.string().min(1)).min(1) },
        async execute(args) {
          return JSON.stringify(await new VerificationReportService(store(), directory).generate(args.testRecordIds));
        },
      }),
    },
  };
};

function isMutatingTool(toolName: string): boolean {
  return ["write", "edit", "patch", "apply_patch", "bash", "shell"].includes(toolName.toLowerCase());
}

function enforceReadBoundary(
  workspaceRoot: string,
  command: string | undefined,
  toolName: string,
  args: Record<string, unknown>,
): void {
  const normalizedTool = toolName.toLowerCase();
  if (command === "sdlc-spec" && ["glob", "grep"].includes(normalizedTool)) {
    throw new Error("需求阶段禁止扫描工作区；请使用 sdlc_status、sdlc_source_read 或 sdlc_context_assemble");
  }
  if (["sdlc-review", "sdlc-status", "sdlc-init"].includes(command ?? "")
    && ["read", "glob", "grep", "list"].includes(normalizedTool)) {
    throw new Error("当前生命周期命令禁止扫描或直接读取工作区；请使用对应的 sdlc_* 只读工具");
  }
  if (!new Set(["read", "glob", "grep", "list"]).has(normalizedTool)) return;
  const rawPath = [args.filePath, args.path].find((value): value is string => typeof value === "string");
  if (!rawPath) return;
  const resolved = path.resolve(workspaceRoot, rawPath);
  const portable = resolved.replaceAll("\\", "/").toLowerCase();
  if (portable.includes("/.sdlc-factory/") || portable.endsWith("/.sdlc-factory")
    || portable.includes("/.opencode/") || portable.endsWith("/.opencode")) {
    throw new Error("生命周期命令不得直接读取插件内部状态目录");
  }
  if (command === "sdlc-spec") {
    const requirementsRoot = path.resolve(workspaceRoot, "docs", "requirements");
    const relative = path.relative(requirementsRoot, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("需求阶段原始资料只能通过 sdlc_source_read 读取，原生 read 仅限当前需求草案");
    }
  }
}
