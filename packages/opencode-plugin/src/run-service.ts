import type { CommandEvidence, JournalEvent, RunRecord, RunState } from "./domain.js";
import type { ProjectStore } from "./project-store.js";

export class InvalidRunOutcomeError extends Error {}
export class CodingTodoRequiredError extends Error {}

type RuntimeValues = { id(): string; now(): string };
type TodoItem = { id: string; content: string; status: string; priority: string };

const FILE_MUTATING_TOOLS = new Set(["write", "edit", "patch", "apply_patch", "bash", "shell"]);

export class RunService {
  constructor(private readonly store: ProjectStore, private readonly runtime: RuntimeValues) {}

  async start(input: Omit<RunRecord, "runId" | "createdAt">): Promise<RunRecord> {
    const active = await this.findActiveRun(input.sessionId);
    if (active) throw new Error(`当前会话已有未结束运行: ${active.runId}`);
    const run: RunRecord = { runId: this.runtime.id(), ...input, createdAt: this.runtime.now() };
    await this.store.writeImmutable("runs", run.runId, run);
    await this.store.appendJournal({
      type: "RUN_STARTED",
      at: run.createdAt,
      runId: run.runId,
      sessionId: run.sessionId,
      command: run.command,
      commandType: run.commandType,
      scope: run.scope,
      inputVersionIds: run.inputVersionIds,
      gitBase: run.gitBase,
    });
    return run;
  }

  async recordTodoInvocation(sessionId: string): Promise<void> {
    const run = await this.findActiveRun(sessionId);
    if (run?.commandType !== "CODE") return;
    await this.store.appendJournal({ type: "TODOWRITE_INVOKED", at: this.runtime.now(), runId: run.runId, sessionId });
  }

  async captureTodo(sessionId: string, todos: TodoItem[]): Promise<void> {
    const run = await this.findActiveRun(sessionId);
    if (run?.commandType !== "CODE") return;
    await this.store.appendJournal({
      type: "TODO_UPDATED",
      at: this.runtime.now(),
      runId: run.runId,
      sessionId,
      todos: todos.map(({ id, content, status, priority }) => ({ id, content, status, priority })),
    });
  }

  async assertToolAllowed(sessionId: string, toolName: string): Promise<void> {
    if (!FILE_MUTATING_TOOLS.has(toolName.toLowerCase())) return;
    const run = await this.findActiveRun(sessionId);
    if (run?.commandType !== "CODE") return;
    const events = await this.runEvents(run.runId);
    const invoked = events.some((event) => event.type === "TODOWRITE_INVOKED");
    const todo = latestTodo(events);
    if (!invoked || !todo || todo.length === 0) {
      throw new CodingTodoRequiredError("编码运行在修改文件或执行命令前必须实际调用 todowrite 并建立待办清单");
    }
  }

  async requireActiveCodingRun(sessionId: string): Promise<RunRecord> {
    const run = await this.findActiveRun(sessionId);
    if (!run || run.commandType !== "CODE") {
      throw new CodingTodoRequiredError("编码命令必须先通过 sdlc_run_start 建立当前会话运行记录");
    }
    return run;
  }

  async finish(runId: string, state: Exclude<RunState, "STARTED">) {
    const run = await this.store.readJson<RunRecord>("runs", runId);
    const events = await this.runEvents(runId);
    if (events.some((event) => event.type === "RUN_FINISHED")) {
      throw new InvalidRunOutcomeError(`运行已经结束: ${runId}`);
    }
    const evidence = await this.commandEvidence(runId);
    if (state === "SUCCEEDED") {
      if (evidence.length === 0) throw new InvalidRunOutcomeError("成功运行至少需要一条系统采集的命令证据");
      if (evidence.some((item) => item.exitCode !== 0 || item.timedOut)) {
        throw new InvalidRunOutcomeError("存在失败或超时命令证据，运行不能标记为成功");
      }
      if (run.commandType === "CODE") {
        const todo = latestTodo(events);
        if (!todo || todo.length < 5 || todo.some((item) => item.status !== "completed")) {
          throw new InvalidRunOutcomeError("成功编码运行必须保留至少五项且全部完成的 OpenCode 待办清单");
        }
      }
    }
    const result = { type: "RUN_FINISHED", runId, state, at: this.runtime.now() };
    await this.store.appendJournal(result);
    return result;
  }

  async findActiveRun(sessionId: string): Promise<RunRecord | undefined> {
    const [runs, events] = await Promise.all([
      this.store.listJson<RunRecord>("runs"),
      this.store.readJournal<JournalEvent>(),
    ]);
    const finished = new Set(events.filter((event) => event.type === "RUN_FINISHED").map((event) => String(event.runId)));
    return runs
      .filter((run) => run.sessionId === sessionId && !finished.has(run.runId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async state(runId: string): Promise<RunState> {
    const events = await this.runEvents(runId);
    const finished = [...events].reverse().find((event) => event.type === "RUN_FINISHED");
    return finished ? finished.state as RunState : "STARTED";
  }

  private async runEvents(runId: string): Promise<JournalEvent[]> {
    return (await this.store.readJournal<JournalEvent>()).filter((event) => event.runId === runId);
  }

  private async commandEvidence(runId: string): Promise<CommandEvidence[]> {
    return (await this.store.listJson<CommandEvidence>("command-evidence")).filter((item) => item.runId === runId);
  }
}

function latestTodo(events: JournalEvent[]): TodoItem[] | undefined {
  const event = [...events].reverse().find((candidate) => candidate.type === "TODO_UPDATED");
  return event?.todos as TodoItem[] | undefined;
}
