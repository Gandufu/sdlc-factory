import type { ProjectStore } from "./project-store.js";

export class InvalidRunOutcomeError extends Error {}

type RuntimeValues = { id(): string; now(): string };
type RunStart = { command: string; sessionId: string; cuId?: string; gitBase: string };
type ToolResult = { tool: string; exitCode: number; outputHash: string };

export class RunService {
  constructor(private readonly store: ProjectStore, private readonly runtime: RuntimeValues) {}

  async start(input: RunStart): Promise<{ runId: string; state: "STARTED" }> {
    const runId = this.runtime.id();
    await this.store.appendJournal({ type: "RUN_STARTED", runId, state: "STARTED", ...input, at: this.runtime.now() });
    return { runId, state: "STARTED" };
  }

  async recordToolResult(runId: string, result: ToolResult): Promise<void> {
    await this.store.appendJournal({ type: "TOOL_RESULT", runId, ...result, at: this.runtime.now() });
  }

  async finish(runId: string, state: "SUCCEEDED" | "FAILED" | "BLOCKED") {
    const events = await this.store.readJournal<ArrayValue>();
    const toolResults = events.filter(
      (event): event is ToolResultEvent => event.type === "TOOL_RESULT" && event.runId === runId,
    );
    if (state === "SUCCEEDED" && toolResults.some((event) => event.exitCode !== 0)) {
      throw new InvalidRunOutcomeError("A run with failing command evidence cannot succeed");
    }
    const result = { type: "RUN_FINISHED", runId, state, at: this.runtime.now() };
    await this.store.appendJournal(result);
    return result;
  }
}

type ArrayValue = { type?: string; runId?: string; exitCode?: number };
type ToolResultEvent = ArrayValue & { type: "TOOL_RESULT"; runId: string; exitCode: number };
