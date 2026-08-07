import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { tool, type Plugin } from "@opencode-ai/plugin";

import { CandidateService } from "./candidate-service.js";
import { validateExecutionPlan } from "./execution-plan.js";
import { sha256 } from "./hash.js";
import { ProjectStore } from "./project-store.js";
import { ReviewService } from "./review-service.js";
import { RunService } from "./run-service.js";
import { SourceService } from "./source-service.js";
import { resolveWorkspacePath } from "./workspace-path.js";

export const SdlcFactoryPlugin: Plugin = async ({ client, directory }) => {
  const runtime = {
    id: randomUUID,
    now: () => new Date().toISOString(),
  };
  const sessionMessages = {
    async latestUserText(sessionId: string): Promise<string> {
      const response = await client.session.messages({
        path: { id: sessionId },
        query: { directory },
      });
      const latest = [...(response.data ?? [])].reverse().find((message) => message.info.role === "user");
      if (!latest) throw new Error(`No user message found in session: ${sessionId}`);
      return latest.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
    },
  };

  return ({
  tool: {
    sdlc_init: tool({
      description: "Initialize deterministic SDLC Factory project state.",
      args: {
        projectName: tool.schema.string().min(1),
        allowedReadRoots: tool.schema.array(tool.schema.string()).default([]),
      },
      async execute(args, context) {
        const store = new ProjectStore(directory);
        await store.writeManifest({
          schemaVersion: 1,
          pluginVersion: "0.0.1",
          projectName: args.projectName,
          workspaceRoot: directory,
          allowedReadRoots: args.allowedReadRoots,
          initializedBySessionId: context.sessionID,
        });
        await store.appendJournal({
          type: "PROJECT_INITIALIZED",
          sessionId: context.sessionID,
          projectName: args.projectName,
        });
        return JSON.stringify({ initialized: true });
      },
    }),
    sdlc_source_snapshot: tool({
      description: "Snapshot an explicitly authorized external source into immutable project state.",
      args: {
        sourceId: tool.schema.string().min(1),
        sourcePath: tool.schema.string().min(1),
      },
      async execute(args) {
        const store = new ProjectStore(directory);
        const manifest = await store.readManifest<{ allowedReadRoots: string[] }>();
        const snapshot = await new SourceService(
          store,
          directory,
          manifest.allowedReadRoots,
        ).snapshot(args.sourceId, args.sourcePath);
        return JSON.stringify(snapshot);
      },
    }),
    sdlc_source_read: tool({
      description: "Read a bounded page from a snapshotted text source by stable source id.",
      args: {
        sourceId: tool.schema.string().min(1),
        offset: tool.schema.number().int().nonnegative().default(0),
        limit: tool.schema.number().int().min(1).max(12000).default(12000),
      },
      async execute(args) {
        const store = new ProjectStore(directory);
        const snapshot = await store.readJson<{
          sourceId: string;
          originalPath: string;
          snapshotPath: string;
          sha256: string;
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
      description: "Copy exact bytes from an immutable source snapshot into a bounded target workspace path.",
      args: {
        sourceId: tool.schema.string().min(1),
        targetPath: tool.schema.string().min(1),
      },
      async execute(args) {
        const store = new ProjectStore(directory);
        const snapshot = await store.readJson<{
          sourceId: string;
          snapshotPath: string;
          sha256: string;
        }>("sources", args.sourceId);
        const target = await resolveWorkspacePath(directory, args.targetPath);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(snapshot.snapshotPath, target);
        const actualHash = sha256(await readFile(target));
        if (actualHash !== snapshot.sha256) {
          throw new Error(`Materialized source hash mismatch: ${args.sourceId}`);
        }
        return JSON.stringify({
          sourceId: args.sourceId,
          targetPath: args.targetPath,
          sha256: actualHash,
        });
      },
    }),
    sdlc_document_write: tool({
      description: "Atomically write a UTF-8 Markdown lifecycle document below the workspace docs directory.",
      args: {
        targetPath: tool.schema.string().min(1),
        content: tool.schema.string(),
      },
      async execute(args) {
        const target = await resolveWorkspacePath(directory, args.targetPath);
        const docsRoot = path.resolve(directory, "docs");
        const relativeToDocs = path.relative(docsRoot, target);
        if (
          relativeToDocs === ".."
          || relativeToDocs.startsWith(`..${path.sep}`)
          || path.isAbsolute(relativeToDocs)
          || path.extname(target).toLowerCase() !== ".md"
        ) {
          throw new Error("Lifecycle documents must be Markdown files inside the docs directory");
        }
        await mkdir(path.dirname(target), { recursive: true });
        const temporary = path.join(
          path.dirname(target),
          `.${path.basename(target)}.${randomUUID()}.tmp`,
        );
        try {
          await writeFile(temporary, args.content, { encoding: "utf8", flag: "wx" });
          await rename(temporary, target);
        } finally {
          await rm(temporary, { force: true });
        }
        return JSON.stringify({
          targetPath: args.targetPath,
          sha256: sha256(Buffer.from(args.content, "utf8")),
        });
      },
    }),
    sdlc_status: tool({
      description: "Read deterministic SDLC Factory project status.",
      args: {},
      async execute() {
        const initialized = existsSync(path.join(directory, ".sdlc-factory", "manifest.json"));
        if (!initialized) {
          return JSON.stringify({
              initialized: false,
              recommendedAction: {
                action: "INIT",
                todo: "执行 /sdlc-init",
                command: "/sdlc-init",
              },
            });
        }
        const store = new ProjectStore(directory);
        const [sources, candidates, baselines, plans] = await Promise.all([
          store.listJson<{ sourceId: string; sha256: string }>("sources"),
          store.listJson<{ candidateId: string; kind: string; contentHash: string }>("candidates"),
          store.listJson<{ baselineId: string; candidateId: string; candidateHash: string }>("baselines"),
          store.listJson<{ planVersion: number; designBaselineId: string; designHash: string; units: unknown[] }>("plans"),
        ]);
        const status: Record<string, unknown> = { initialized: true };
        if (sources.length > 0) {
          status.registeredSources = sources.map(({ sourceId, sha256 }) => ({ sourceId, sha256 }));
        }
        if (candidates.length > 0) status.candidates = candidates;
        if (baselines.length > 0) status.baselines = baselines;
        if (plans.length > 0) status.executionPlans = plans;
        return JSON.stringify(status);
      },
    }),
    sdlc_candidate_create: tool({
      description: "Create an immutable candidate from exact workspace document bytes.",
      args: {
        kind: tool.schema.enum(["REQUIREMENT", "DESIGN", "CODE", "TEST", "SYSTEM_ACCEPTANCE"]),
        subjectPaths: tool.schema.array(tool.schema.string().min(1)).min(1),
        runId: tool.schema.string().min(1).optional(),
        gitBase: tool.schema.string().min(1).optional(),
        cuName: tool.schema.string().min(1).optional(),
        inputBaselineIds: tool.schema.array(tool.schema.string().min(1)).optional(),
      },
      async execute(args) {
        const requiresProvenance = ["CODE", "TEST", "SYSTEM_ACCEPTANCE"].includes(args.kind);
        if (requiresProvenance && (
          !args.runId
          || !args.gitBase
          || !args.cuName
          || !args.inputBaselineIds?.length
        )) {
          throw new Error(`${args.kind} Candidate requires Run, Git base, CU name and input Baselines`);
        }
        const provenance = args.runId && args.gitBase && args.cuName && args.inputBaselineIds?.length
          ? {
              runId: args.runId,
              gitBase: args.gitBase,
              cuName: args.cuName,
              inputBaselineIds: args.inputBaselineIds,
            }
          : undefined;
        const candidate = await new CandidateService(
          new ProjectStore(directory),
          directory,
          runtime,
        ).createDocumentCandidate(args.kind, args.subjectPaths, provenance);
        return JSON.stringify(candidate);
      },
    }),
    sdlc_review_apply: tool({
      description: "Apply a review only when tool arguments match the current session's direct user message and candidate hash.",
      args: {
        candidateId: tool.schema.string().min(1),
        candidateHash: tool.schema.string().regex(/^[a-f0-9]{64}$/u),
        decision: tool.schema.enum(["APPROVE", "REVISE", "HOLD"]),
      },
      async execute(args, context) {
        const result = await new ReviewService(
          new ProjectStore(directory),
          sessionMessages,
          runtime,
        ).apply(context.sessionID, args);
        return JSON.stringify(result);
      },
    }),
    sdlc_plan_save: tool({
      description: "Validate and save an immutable CU execution plan against an approved design baseline.",
      args: {
        planVersion: tool.schema.number().int().positive(),
        designBaselineId: tool.schema.string().min(1),
        designHash: tool.schema.string().regex(/^[a-f0-9]{64}$/u),
        units: tool.schema.array(tool.schema.object({
          cuId: tool.schema.string().min(1),
          cuName: tool.schema.string().min(1),
          dependencies: tool.schema.array(tool.schema.string().min(1)),
        })).min(1),
      },
      async execute(args) {
        const store = new ProjectStore(directory);
        const baseline = await store.readJson<{ candidateHash: string }>("baselines", args.designBaselineId);
        if (baseline.candidateHash !== args.designHash) {
          throw new Error("ExecutionPlan design hash does not match its approved DesignBaseline");
        }
        const plan = {
          planVersion: args.planVersion,
          designBaselineId: args.designBaselineId,
          designHash: args.designHash,
          units: args.units,
        };
        validateExecutionPlan(plan);
        await store.writeImmutable("plans", `execution-plan-v${args.planVersion}`, plan);
        return JSON.stringify(plan);
      },
    }),
    sdlc_run_start: tool({
      description: "Start a journaled CU run by exact user-readable CU name from the latest ExecutionPlan.",
      args: {
        command: tool.schema.string().min(1),
        cuName: tool.schema.string().min(1),
        gitBase: tool.schema.string().min(1),
      },
      async execute(args, context) {
        const store = new ProjectStore(directory);
        const plans = await store.listJson<{
          planVersion: number;
          units: Array<{ cuId: string; cuName: string }>;
        }>("plans");
        const latest = plans.sort((left, right) => right.planVersion - left.planVersion)[0];
        if (!latest) throw new Error("No ExecutionPlan exists");
        const unit = latest.units.find((candidate) => candidate.cuName === args.cuName);
        if (!unit) throw new Error(`CU name is not in the latest ExecutionPlan: ${args.cuName}`);
        const allowedCommands = [`/sdlc-code ${args.cuName}`, `/sdlc-test ${args.cuName}`];
        if (!allowedCommands.includes(args.command)) {
          throw new Error("Run command must contain the exact CU name from the latest ExecutionPlan");
        }
        const result = await new RunService(store, runtime).start({
          command: args.command,
          sessionId: context.sessionID,
          cuId: unit.cuId,
          gitBase: args.gitBase,
        });
        return JSON.stringify({ ...result, cuId: unit.cuId, cuName: unit.cuName, planVersion: latest.planVersion });
      },
    }),
    sdlc_run_record_result: tool({
      description: "Append exact command evidence to a journaled run.",
      args: {
        runId: tool.schema.string().min(1),
        tool: tool.schema.string().min(1),
        exitCode: tool.schema.number().int(),
        outputHash: tool.schema.string().regex(/^[a-f0-9]{64}$/u),
      },
      async execute(args) {
        const service = new RunService(new ProjectStore(directory), runtime);
        await service.recordToolResult(args.runId, {
          tool: args.tool,
          exitCode: args.exitCode,
          outputHash: args.outputHash,
        });
        return JSON.stringify({ recorded: true, runId: args.runId });
      },
    }),
    sdlc_run_finish: tool({
      description: "Finish a journaled run; a run with captured failing evidence cannot succeed.",
      args: {
        runId: tool.schema.string().min(1),
        state: tool.schema.enum(["SUCCEEDED", "FAILED", "BLOCKED"]),
      },
      async execute(args) {
        return JSON.stringify(await new RunService(
          new ProjectStore(directory),
          runtime,
        ).finish(args.runId, args.state));
      },
    }),
  },
  });
};
