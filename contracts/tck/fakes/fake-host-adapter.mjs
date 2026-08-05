import process from "node:process";

const scenario = process.argv[2] ?? "success";
const input = JSON.parse(await readStdin());
const occurredAt = "2026-08-05T10:00:00Z";
const baseEvent = {
  event_id: "HEV-FAKE-1",
  run_id: input.run_id,
  invocation_id: input.invocation_id,
  host_session_id: "fake-session-1",
  sequence: 0,
  occurred_at: occurredAt,
  payload: { sanitized: true, adapter: "fake-host", scenario },
};

if (scenario === "success") {
  const handoff = {
    protocol_version: "1.0",
    handoff_id: "HND-FAKE-1",
    run_id: input.run_id,
    role: "CODER",
    summary: "Fake host completed the invocation",
    observations: [],
    declared_changed_paths: ["src/fake.ts"],
    validations: [{ name: "fake-check", outcome: "PASSED", evidence_refs: ["EVD-FAKE-HOST-1"] }],
    open_issues: [],
    submitted_at: occurredAt,
  };
  emit({
    event: { ...baseEvent, event_type: "SESSION_IDLE" },
    handoff,
    result: {
      result_id: "HRS-FAKE-1",
      run_id: input.run_id,
      invocation_id: input.invocation_id,
      host_session_id: "fake-session-1",
      status: "SUCCEEDED",
      handoff_ref: "handoffs/HND-FAKE-1.json",
      usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0, host_calls: 1 },
      completed_at: occurredAt,
    },
  });
} else if (scenario === "invalid-structured") {
  const error = {
    error_id: "ERR-FAKE-HOST-1",
    run_id: input.run_id,
    source: "HOST_ADAPTER",
    category: "STRUCTURED_OUTPUT",
    code: "STRUCTURED_OUTPUT_INVALID",
    message: "Host returned no schema-valid structured object",
    retryable: false,
    fingerprint: `sha256:${"a".repeat(64)}`,
    sanitized: true,
    details: { host_finish: "tool-calls" },
    occurred_at: occurredAt,
  };
  emit({
    event: { ...baseEvent, event_type: "HOST_ERROR" },
    error,
    result: {
      result_id: "HRS-FAKE-1",
      run_id: input.run_id,
      invocation_id: input.invocation_id,
      host_session_id: "fake-session-1",
      status: "FAILED",
      error_ref: error.error_id,
      usage: { input_tokens: 10, output_tokens: 0, cost_usd: 0, host_calls: 1 },
      completed_at: occurredAt,
    },
  });
} else {
  throw new Error(`Unknown fake host scenario: ${scenario}`);
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readStdin() {
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  return value;
}
