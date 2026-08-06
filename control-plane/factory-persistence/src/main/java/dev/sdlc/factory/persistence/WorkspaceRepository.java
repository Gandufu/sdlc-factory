package dev.sdlc.factory.persistence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;

/** 项目连续会话、Run 关联和人工 Gate 的 PostgreSQL 事实存储。 */
public final class WorkspaceRepository {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;

    public WorkspaceRepository(JdbcTemplate jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    public Map<String, Object> project(String projectId) {
        return jdbc.queryForMap("""
                SELECT p.project_id, p.name, i.state AS initialization_state, i.workspace_path,
                       i.initial_git_revision, b.template_id, b.template_version, b.template_digest
                FROM project p JOIN project_initialization i USING(project_id)
                JOIN template_binding b USING(project_id) WHERE p.project_id = ?
                """, projectId);
    }

    public List<Map<String, Object>> sessions(String projectId) {
        return jdbc.queryForList("""
                SELECT s.session_id, s.parent_session_id, s.agent, s.title, s.state, s.current,
                       s.archived, s.created_at, s.updated_at,
                       COALESCE(string_agg(sr.run_id, ',' ORDER BY sr.linked_at), '') AS run_ids
                FROM factory_session s LEFT JOIN session_run sr USING(session_id)
                WHERE s.project_id = ?
                GROUP BY s.session_id ORDER BY s.archived, s.current DESC, s.updated_at DESC
                """, projectId);
    }

    public Map<String, Object> session(String projectId, String sessionId) {
        return jdbc.queryForMap("""
                SELECT session_id, parent_session_id, agent, title, state, current, archived,
                       created_at, updated_at FROM factory_session
                WHERE project_id = ? AND session_id = ?
                """, projectId, sessionId);
    }

    public List<Map<String, Object>> messages(String sessionId) {
        return jdbc.queryForList("""
                SELECT message_id, role, content, run_id, created_at
                FROM session_message WHERE session_id = ? ORDER BY created_at, message_id
                """, sessionId);
    }

    public List<Map<String, Object>> sessionRuns(String sessionId) {
        return jdbc.queryForList("""
                SELECT r.run_id, r.status, r.created_at FROM session_run sr
                JOIN run r USING(run_id) WHERE sr.session_id = ? ORDER BY sr.linked_at
                """, sessionId);
    }

    public List<Map<String, Object>> artifacts(String sessionId) {
        return jdbc.queryForList("""
                SELECT h.handoff_id AS artifact_id, 'HANDOFF' AS artifact_type, h.artifact_ref,
                       h.content_hash, h.submitted_at AS created_at, h.run_id
                FROM handoff h JOIN session_run sr USING(run_id) WHERE sr.session_id = ?
                UNION ALL
                SELECT e.evidence_id, e.evidence_type, e.storage_ref, e.content_hash, e.produced_at, e.run_id
                FROM evidence e JOIN session_run sr USING(run_id) WHERE sr.session_id = ?
                ORDER BY created_at, artifact_id
                """, sessionId, sessionId);
    }

    public List<Map<String, Object>> gates(String projectId) {
        return jdbc.queryForList("""
                SELECT g.gate_id, g.session_id, g.run_id, g.gate_type, g.expected_version,
                       g.status, g.candidate_ref, g.handoff_id, g.review_record_id, g.baseline_id,
                       g.created_at, g.decided_at, h.content_hash AS candidate_content_hash,
                       h.payload::text AS handoff_payload
                FROM stage_gate g LEFT JOIN handoff h USING(handoff_id)
                WHERE g.project_id = ? ORDER BY g.created_at DESC
                """, projectId);
    }

    public List<Map<String, Object>> checks(String runId) {
        return jdbc.queryForList("""
                SELECT execution_id AS check_id, operation, operation_status AS status,
                       test_outcome, exit_code, completed_at
                FROM execution_result WHERE run_id = ? ORDER BY completed_at
                """, runId);
    }

    public List<Map<String, Object>> evidence(String runId) {
        return jdbc.queryForList("""
                SELECT evidence_id, evidence_type, storage_ref, content_hash, produced_at
                FROM evidence WHERE run_id = ? ORDER BY produced_at
                """, runId);
    }

    public List<Map<String, Object>> baselines(String projectId) {
        return jdbc.queryForList("""
                SELECT baseline_id, baseline_type, artifact_version, content_hash, source_revision,
                       review_record_id, validity_status, created_at
                FROM baseline WHERE scope_type = 'PROJECT' AND scope_id = ? ORDER BY created_at
                """, projectId);
    }

    public List<Map<String, Object>> observedRuntimeBindings(String projectId) {
        return jdbc.queryForList("""
                SELECT DISTINCT a.adapter_id, a.adapter_version, a.host_version, a.sdk_version
                FROM agent_invocation a JOIN run r USING(run_id)
                WHERE r.project_id = ? ORDER BY a.adapter_id, a.adapter_version
                """, projectId);
    }

    public void createSession(String projectId, String sessionId, String parentSessionId,
                              String agent, String title) {
        transactions.executeWithoutResult(ignored -> {
            if (parentSessionId != null) {
                Integer parentCount = jdbc.queryForObject("""
                        SELECT count(*) FROM factory_session WHERE session_id=? AND project_id=?
                        """, Integer.class, parentSessionId, projectId);
                if (parentCount == null || parentCount == 0) {
                    throw new IllegalArgumentException("parent_session_id 不属于当前项目");
                }
            }
            jdbc.update("UPDATE factory_session SET current=false, updated_at=now() WHERE project_id=? AND current", projectId);
            jdbc.update("""
                    INSERT INTO factory_session(session_id, project_id, parent_session_id, agent, title, state, current)
                    VALUES (?, ?, ?, ?, ?, 'ACTIVE', true)
                    """, sessionId, projectId, parentSessionId, agent, title);
        });
    }

    public void archiveSession(String projectId, String sessionId) {
        int changed = jdbc.update("""
                UPDATE factory_session SET archived=true, current=false, state='COMPLETED', updated_at=now()
                WHERE project_id=? AND session_id=? AND NOT archived
                """, projectId, sessionId);
        if (changed == 0) throw new IllegalStateException("会话不存在或已归档");
    }

    public void addMessage(String sessionId, String messageId, String role, String content, String runId) {
        jdbc.update("""
                INSERT INTO session_message(message_id, session_id, run_id, role, content)
                VALUES (?, ?, ?, ?, ?)
                """, messageId, sessionId, runId, role, content);
        jdbc.update("UPDATE factory_session SET updated_at=now() WHERE session_id=?", sessionId);
    }

    public void linkRun(String sessionId, String runId, String state) {
        transactions.executeWithoutResult(ignored -> {
            jdbc.update("INSERT INTO session_run(session_id, run_id) VALUES (?, ?)", sessionId, runId);
            jdbc.update("UPDATE factory_session SET state=?, updated_at=now() WHERE session_id=?", state, sessionId);
        });
    }

    public void reopenAfterRecoveryCheck(String sessionId) {
        int changed = jdbc.update("""
                UPDATE factory_session SET state='ACTIVE', updated_at=now()
                WHERE session_id=? AND state='BLOCKED' AND current AND NOT archived
                """, sessionId);
        if (changed == 0) throw new IllegalStateException("阻塞会话不可恢复或已不再是当前会话");
    }

    public void createGate(String projectId, String sessionId, String runId, String gateId,
                           String handoffId) {
        jdbc.update("""
                INSERT INTO stage_gate(gate_id, project_id, session_id, run_id, gate_type, status,
                    candidate_ref, handoff_id)
                VALUES (?, ?, ?, ?, 'SYSTEM_ACCEPTANCE', 'WAITING', ?, ?)
                """, gateId, projectId, sessionId, runId, "database:handoff/" + handoffId, handoffId);
    }

    public Map<String, Object> gate(String projectId, String gateId) {
        return jdbc.queryForMap("""
                SELECT g.*, h.content_hash FROM stage_gate g JOIN handoff h USING(handoff_id)
                WHERE g.project_id=? AND g.gate_id=?
                """, projectId, gateId);
    }

    public void decideGate(String projectId, String gateId, String reviewer, String comments,
                           String idempotencyKey, int expectedVersion, boolean approve,
                           String reviewId, String baselineId) {
        transactions.executeWithoutResult(ignored -> {
            Integer replay = jdbc.queryForObject(
                    "SELECT count(*) FROM review_record WHERE idempotency_key=?", Integer.class, idempotencyKey);
            if (replay != null && replay > 0) return;
            Map<String, Object> gate = gate(projectId, gateId);
            if (!"WAITING".equals(gate.get("status"))) throw new IllegalStateException("Gate 已完成裁决");
            if (((Number) gate.get("expected_version")).intValue() != expectedVersion) {
                throw new IllegalStateException("Gate expected_version 已过期");
            }
            jdbc.update("""
                    INSERT INTO review_record(review_id, scope_type, scope_id, stage_type,
                        baseline_candidate_ref, reviewer_identity, reviewer_role, separation_policy,
                        decision, comments, reviewed_at, idempotency_key)
                    VALUES (?, 'PROJECT', ?, 'SYSTEM_ACCEPTANCE', ?, ?, 'REVIEWER', 'ENFORCED', ?, ?, now(), ?)
                    """, reviewId, projectId, gate.get("candidate_ref"), reviewer,
                    approve ? "APPROVED" : "CHANGES_REQUESTED", comments, idempotencyKey);
            if (approve) {
                jdbc.update("""
                        INSERT INTO baseline(baseline_id, scope_type, scope_id, baseline_type,
                            artifact_version, content_hash, review_record_id, validity_status)
                        VALUES (?, 'PROJECT', ?, 'SYSTEM_ACCEPTANCE',
                            (SELECT COALESCE(MAX(artifact_version), 0) + 1 FROM baseline
                             WHERE scope_type='PROJECT' AND scope_id=? AND baseline_type='SYSTEM_ACCEPTANCE'),
                            ?, ?, 'VALID')
                        """, baselineId, projectId, projectId, gate.get("content_hash"), reviewId);
                jdbc.update("""
                        INSERT INTO baseline_item(baseline_id, artifact_type, artifact_ref, content_hash)
                        VALUES (?, 'HANDOFF', ?, ?)
                        """, baselineId, gate.get("candidate_ref"), gate.get("content_hash"));
            }
            jdbc.update("""
                    UPDATE stage_gate SET status=?, expected_version=expected_version+1,
                        review_record_id=?, baseline_id=?, decided_at=now() WHERE gate_id=?
                    """, approve ? "APPROVED" : "CHANGES_REQUESTED", reviewId,
                    approve ? baselineId : null, gateId);
            jdbc.update("UPDATE factory_session SET state=?, updated_at=now() WHERE session_id=?",
                    approve ? "COMPLETED" : "ACTIVE", gate.get("session_id"));
        });
    }
}
