import process from "node:process";

const scenario = process.argv[2] ?? "test-success";
const input = JSON.parse(await readStdin());
const startedAt = "2026-08-05T10:00:00Z";
const completedAt = "2026-08-05T10:00:01Z";
const evidence = {
  evidence_id: "EVD-FAKE-RUNNER-1",
  run_id: input.run_id,
  evidence_type: "TEST_RESULT",
  media_type: "application/json",
  storage_ref: "evidence/EVD-FAKE-RUNNER-1.json",
  content_hash: `sha256:${"b".repeat(64)}`,
  byte_length: 64,
  source: { kind: "RUNNER", source_id: "EXE-FAKE-1", command_digest: `sha256:${"c".repeat(64)}` },
  sanitized: true,
  produced_at: completedAt,
};

if (scenario === "test-success") {
  emit({ evidence, result: result({ operation: "TEST", operation_status: "SUCCEEDED", test_outcome: "PASSED", exit_code: 0 }) });
} else if (scenario === "start-success") {
  const lease = {
    runtime_id: "RTM-FAKE-1",
    owner_run_id: input.run_id,
    process_handles: ["fake:1"],
    endpoints: ["http://127.0.0.1:8080/health"],
    allocated_ports: [8080],
    started_at: startedAt,
    readiness_status: "READY",
    lease_expires_at: "2026-08-05T10:10:00Z",
    cleanup_token_hash: `sha256:${"d".repeat(64)}`,
  };
  emit({ evidence, lease, result: result({ operation: "START", operation_status: "SUCCEEDED", exit_code: 0, runtime_lease_ref: lease.runtime_id }) });
} else if (scenario === "timeout") {
  const error = {
    error_id: "ERR-FAKE-RUNNER-1",
    run_id: input.run_id,
    source: "RUNNER",
    category: "TIMEOUT",
    code: "RUNNER_TIMEOUT",
    message: "Fake runner exceeded its deadline",
    retryable: false,
    fingerprint: `sha256:${"e".repeat(64)}`,
    sanitized: true,
    occurred_at: completedAt,
  };
  emit({ evidence, error, result: result({ operation: "TEST", operation_status: "TIMED_OUT", test_outcome: "BLOCKED", exit_code: null, error_ref: error.error_id }) });
} else {
  throw new Error(`Unknown fake runner scenario: ${scenario}`);
}

function result(extra) {
  return {
    execution_id: "EXE-FAKE-1",
    run_id: input.run_id,
    started_at: startedAt,
    completed_at: completedAt,
    evidence_refs: [evidence.evidence_id],
    ...extra,
  };
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readStdin() {
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  return value;
}
