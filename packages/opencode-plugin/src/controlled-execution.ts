import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CommandEvidence, ProjectManifest, RunRecord } from "./domain.js";
import { assertSafeCommandArguments } from "./command-safety.js";
import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { RunService } from "./run-service.js";
import { resolveWorkspacePath } from "./workspace-path.js";

const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;
const WINDOWS_SHELL_META = /[&|<>^%\r\n]/u;

type RuntimeValues = { id(): string; now(): string };
type ExecuteInput = {
  runId: string;
  executable: string;
  arguments: string[];
  workingDirectory: string;
  timeoutMs: number;
};

export class ControlledExecutionService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly runtime: RuntimeValues,
  ) {}

  async execute(input: ExecuteInput): Promise<CommandEvidence & { stdoutTail: string; stderrTail: string }> {
    const [run, manifest] = await Promise.all([
      this.store.readJson<RunRecord>("runs", input.runId),
      this.store.readManifest<ProjectManifest>(),
    ]);
    const executable = path.basename(input.executable).replace(/\.(?:cmd|exe)$/iu, "").toLowerCase();
    if (!/^[A-Za-z0-9._-]+$/u.test(input.executable)) {
      throw new Error("执行程序必须是允许列表中的简单名称，不能包含路径");
    }
    if (!manifest.allowedExecutables.map((item) => item.toLowerCase()).includes(executable)) {
      throw new Error(`执行程序未获项目允许: ${executable}`);
    }
    if (input.timeoutMs < 1_000 || input.timeoutMs > 30 * 60_000) {
      throw new Error("命令超时必须在 1 秒到 30 分钟之间");
    }
    if (await new RunService(this.store, this.runtime).state(input.runId) !== "STARTED") {
      throw new Error(`运行已经结束，不能继续执行命令: ${input.runId}`);
    }
    if (process.platform === "win32" && [input.executable, ...input.arguments].some((value) => WINDOWS_SHELL_META.test(value))) {
      throw new Error("Windows 受控命令参数不能包含 shell 元字符");
    }
    assertSafeCommandArguments(input.arguments);
    const workingDirectory = await resolveWorkspacePath(this.workspaceRoot, input.workingDirectory);
    const evidenceId = this.runtime.id();
    const evidenceDirectory = path.join(this.workspaceRoot, "evidence", run.runId);
    await mkdir(evidenceDirectory, { recursive: true });
    const stdoutPath = path.join(evidenceDirectory, `${evidenceId}.stdout.log`);
    const stderrPath = path.join(evidenceDirectory, `${evidenceId}.stderr.log`);
    const startedAt = this.runtime.now();
    const startedMs = Date.now();
    const result = await executeChild(input.executable, input.arguments, workingDirectory, input.timeoutMs);
    const stdout = redact(result.stdout);
    const stderr = redact(result.stderr);
    await Promise.all([writeFile(stdoutPath, stdout, "utf8"), writeFile(stderrPath, stderr, "utf8")]);
    const finishedAt = this.runtime.now();
    const evidence: CommandEvidence = {
      evidenceId,
      runId: input.runId,
      executable,
      arguments: input.arguments,
      workingDirectory: path.relative(this.workspaceRoot, workingDirectory).replaceAll("\\", "/") || ".",
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      stdoutPath: path.relative(this.workspaceRoot, stdoutPath).replaceAll("\\", "/"),
      stdoutHash: sha256(Buffer.from(stdout, "utf8")),
      stderrPath: path.relative(this.workspaceRoot, stderrPath).replaceAll("\\", "/"),
      stderrHash: sha256(Buffer.from(stderr, "utf8")),
    };
    await this.store.writeImmutable("command-evidence", evidence.evidenceId, evidence);
    await this.store.appendJournal({
      type: "COMMAND_EVIDENCE_RECORDED",
      at: finishedAt,
      runId: run.runId,
      evidenceId,
      exitCode: evidence.exitCode,
      timedOut: evidence.timedOut,
    });
    return { ...evidence, stdoutTail: tail(stdout), stderrTail: tail(stderr) };
  }
}

function executeChild(
  executable: string,
  arguments_: string[],
  workingDirectory: string,
  timeoutMs: number,
): Promise<{ exitCode: number | null; timedOut: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: workingDirectory,
      env: process.env,
      shell: process.platform === "win32",
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let captured = 0;
    let timedOut = false;
    const capture = (target: Buffer[], value: Buffer) => {
      captured += value.byteLength;
      if (captured > MAX_CAPTURE_BYTES) {
        child.kill();
        return;
      }
      target.push(value);
    };
    child.stdout.on("data", (value: Buffer) => capture(stdout, value));
    child.stderr.on("data", (value: Buffer) => capture(stderr, value));
    child.once("error", reject);
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.once("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({
        exitCode: captured > MAX_CAPTURE_BYTES ? null : exitCode,
        timedOut: timedOut || captured > MAX_CAPTURE_BYTES,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function redact(value: string): string {
  return value
    .replace(/(authorization\s*:\s*bearer)\s+\S+/giu, "$1 [REDACTED]")
    .replace(/((?:password|secret|token|api[_-]?key)\s*[=:]\s*)\S+/giu, "$1[REDACTED]");
}

function tail(value: string): string {
  return value.length <= 8_000 ? value : value.slice(-8_000);
}
