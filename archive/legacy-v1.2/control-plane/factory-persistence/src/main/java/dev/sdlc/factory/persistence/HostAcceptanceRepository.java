package dev.sdlc.factory.persistence;

import dev.sdlc.factory.contracts.handoff.Handoff;
import dev.sdlc.factory.contracts.host.HostRunResult;
import dev.sdlc.factory.contracts.invocation.AgentInvocation;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

/** OpenCode 宿主纵切验收的显式 SQL 存储。 */
public final class HostAcceptanceRepository {

    private final JdbcTemplate jdbc;

    public HostAcceptanceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> project(String projectId) {
        return jdbc.queryForMap("""
                SELECT p.project_id, i.workspace_path FROM project p
                JOIN project_initialization i USING(project_id) WHERE p.project_id = ?
                """, projectId);
    }

    public void createInvocation(String projectId, String runId, String attemptId,
                                 String manifestId, String manifestPayload, String manifestHash,
                                 AgentInvocation invocation, String invocationPayload, String invocationHash) {
        jdbc.update("INSERT INTO run(run_id, project_id, attempt_id, status) VALUES (?, ?, ?, 'RUNNING')",
                runId, projectId, attemptId);
        jdbc.update("""
                INSERT INTO context_manifest(manifest_id, run_id, attempt_id, total_estimated_tokens,
                    payload, content_hash, assembled_at)
                VALUES (?, ?, ?, 0, ?::jsonb, ?, now())
                """, manifestId, runId, attemptId, manifestPayload, manifestHash);
        jdbc.update("""
                INSERT INTO agent_invocation(invocation_id, run_id, attempt_id, context_manifest_id,
                    adapter_id, adapter_version, host_version, sdk_version, output_schema_id,
                    output_schema_version, output_schema_hash, payload_ref, payload_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, invocation.invocationId(), runId, attemptId, manifestId,
                invocation.hostAdapter().id(), invocation.hostAdapter().adapterVersion(),
                invocation.hostAdapter().hostVersion(), invocation.hostAdapter().sdkVersion(),
                invocation.outputContract().schemaId(), invocation.outputContract().schemaVersion(),
                invocation.outputContract().contentHash(), "database:agent_invocation/" + invocation.invocationId(),
                invocationHash, java.sql.Timestamp.from(invocation.createdAt()));
    }

    public void complete(Handoff handoff, String handoffPayload, String handoffHash,
                         HostRunResult result) {
        jdbc.update("""
                INSERT INTO handoff(handoff_id, run_id, role, artifact_ref, content_hash, payload, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)
                """, handoff.handoffId(), handoff.runId(), handoff.role().name(),
                "database:handoff/" + handoff.handoffId(), handoffHash, handoffPayload,
                java.sql.Timestamp.from(handoff.submittedAt()));
        jdbc.update("""
                INSERT INTO host_run_result(result_id, run_id, invocation_id, host_session_id, status,
                    handoff_id, error_id, input_tokens, output_tokens, cost_usd, host_calls, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, result.resultId(), result.runId(), result.invocationId(), result.hostSessionId(),
                result.status().name(), result.handoffRef(), result.errorRef(), result.usage().inputTokens(),
                result.usage().outputTokens(), result.usage().costUsd(), result.usage().hostCalls(),
                java.sql.Timestamp.from(result.completedAt()));
        jdbc.update("UPDATE run SET status='SUCCEEDED' WHERE run_id=?", result.runId());
    }

    public void fail(String errorId, String runId, String fingerprint, String errorPayload,
                     HostRunResult result) {
        jdbc.update("""
                INSERT INTO error_envelope(error_id, run_id, source, category, code, retryable,
                    fingerprint, sanitized, payload, occurred_at)
                VALUES (?, ?, 'HOST_ADAPTER', 'INTERNAL', 'OPENCODE_BRIDGE_FAILED', false,
                    ?, true, ?::jsonb, now())
                """, errorId, runId, fingerprint, errorPayload);
        jdbc.update("""
                INSERT INTO host_run_result(result_id, run_id, invocation_id, host_session_id, status,
                    handoff_id, error_id, input_tokens, output_tokens, cost_usd, host_calls, completed_at)
                VALUES (?, ?, ?, ?, 'FAILED', NULL, ?, 0, 0, 0, 0, ?)
                """, result.resultId(), result.runId(), result.invocationId(), result.hostSessionId(),
                errorId, java.sql.Timestamp.from(result.completedAt()));
        jdbc.update("UPDATE run SET status='FAILED' WHERE run_id=?", runId);
    }

    public Map<String, Object> result(String runId) {
        return jdbc.queryForMap("""
                SELECT r.run_id, r.status AS run_status, a.invocation_id, a.adapter_id,
                    a.adapter_version, a.host_version, a.sdk_version, h.handoff_id,
                    h.payload::text AS handoff_payload, x.result_id, x.host_session_id,
                    x.status, x.input_tokens, x.output_tokens, x.cost_usd, x.host_calls, x.completed_at
                FROM run r JOIN agent_invocation a USING(run_id)
                JOIN host_run_result x USING(run_id, invocation_id)
                JOIN handoff h ON h.handoff_id = x.handoff_id
                WHERE r.run_id = ?
                """, runId);
    }
}
