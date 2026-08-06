package dev.sdlc.factory.persistence;

import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** M1 初始化聚合的显式 SQL 存储；跨表写入由应用层事务边界协调。 */
public final class ProjectInitializationRepository {

    private final JdbcTemplate jdbc;

    public ProjectInitializationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void registerTemplate(String id, String version, String ref, String digest) {
        jdbc.update("""
                INSERT INTO template_registration(template_id, version, descriptor_ref, digest, status,
                    published_by, published_at, publication_reason)
                VALUES (?, ?, ?, ?, 'ACTIVE', 'factory', now(), '内置 M1 Node 模板')
                ON CONFLICT (template_id, version) DO NOTHING
                """, id, version, ref, digest);
    }

    public Map<String, Object> activeTemplate(String id, String version) {
        return jdbc.queryForMap("""
                SELECT template_id, version, descriptor_ref, digest FROM template_registration
                WHERE template_id = ? AND version = ? AND status = 'ACTIVE'
                """, id, version);
    }

    public List<Map<String, Object>> activeTemplates() {
        return jdbc.queryForList("""
                SELECT template_id, version, descriptor_ref, digest
                FROM template_registration WHERE status = 'ACTIVE' ORDER BY template_id, version
                """);
    }

    public void createProject(String projectId, String name, String runId, String workspace,
                              String parameterHash, String templateId, String version, String digest) {
        jdbc.update("INSERT INTO project(project_id, name) VALUES (?, ?)", projectId, name);
        jdbc.update("""
                INSERT INTO template_binding(project_id, template_id, template_version, template_digest, bound_at, binding_reason)
                VALUES (?, ?, ?, ?, now(), '项目初始化选择')
                """, projectId, templateId, version, digest);
        jdbc.update("INSERT INTO run(run_id, project_id, attempt_id, status) VALUES (?, ?, ?, 'RUNNING')",
                runId, projectId, "ATT-1");
        jdbc.update("""
                INSERT INTO project_initialization(project_id, run_id, state, workspace_path, template_parameters_hash)
                VALUES (?, ?, 'TEMPLATE_SELECTED', ?, ?)
                """, projectId, runId, workspace, parameterHash);
    }

    public void updateState(String projectId, String state, String failure) {
        jdbc.update("""
                UPDATE project_initialization SET state = ?, failure_detail = ?, version = version + 1, updated_at = now()
                WHERE project_id = ?
                """, state, failure, projectId);
        if ("FAILED".equals(state)) {
            jdbc.update("UPDATE run SET status = 'FAILED' WHERE run_id = ?", runId(projectId));
        }
    }

    public void completeValidation(String projectId, String revision, String manifestJson) {
        jdbc.update("""
                UPDATE project_initialization SET state = 'AWAITING_REVIEW', initial_git_revision = ?,
                    project_manifest = ?::jsonb, module_topology = '[{"name":"app","kind":"NODE"}]'::jsonb,
                    version = version + 1, updated_at = now() WHERE project_id = ?
                """, revision, manifestJson, projectId);
        jdbc.update("UPDATE run SET status = 'NEEDS_REVIEW' WHERE run_id = (SELECT run_id FROM project_initialization WHERE project_id = ?)", projectId);
    }

    public void saveEvidence(String projectId, String evidenceId, String executionId, String operation,
                             String storageRef, String hash, long bytes, int exitCode, String payloadJson) {
        String runId = runId(projectId);
        jdbc.update("""
                INSERT INTO evidence(evidence_id, run_id, evidence_type, media_type, storage_ref, content_hash,
                    byte_length, source_kind, source_id, sanitized, produced_at)
                VALUES (?, ?, 'COMMAND_OUTPUT', 'text/plain', ?, ?, ?, 'RUNNER', 'windows-native', true, now())
                """, evidenceId, runId, storageRef, hash, bytes);
        String testOutcome = "TEST".equals(operation) ? "PASSED" : null;
        jdbc.update("""
                INSERT INTO execution_result(execution_id, run_id, operation, operation_status, test_outcome,
                    exit_code, payload, started_at, completed_at)
                VALUES (?, ?, ?, 'SUCCEEDED', ?, ?, ?::jsonb, now(), now())
                """, executionId, runId, operation, testOutcome, exitCode, payloadJson);
    }

    public void saveEvidenceOnly(String projectId, String evidenceId, String storageRef, String hash, long bytes) {
        jdbc.update("""
                INSERT INTO evidence(evidence_id, run_id, evidence_type, media_type, storage_ref, content_hash,
                    byte_length, source_kind, source_id, sanitized, produced_at)
                VALUES (?, ?, 'COMMAND_OUTPUT', 'text/plain', ?, ?, ?, 'RUNNER', 'windows-native', true, now())
                """, evidenceId, runId(projectId), storageRef, hash, bytes);
    }

    public List<Map<String, Object>> projects() {
        return jdbc.queryForList("""
                SELECT p.project_id, p.name, i.state, i.workspace_path, i.initial_git_revision, i.updated_at,
                       b.template_id, b.template_version, b.template_digest
                FROM project p JOIN project_initialization i USING(project_id)
                JOIN template_binding b USING(project_id)
                ORDER BY i.updated_at DESC
                """);
    }

    public Map<String, Object> project(String projectId) {
        return jdbc.queryForMap("""
                SELECT p.project_id, p.name, i.state, i.workspace_path, i.initial_git_revision,
                       i.project_manifest::text AS project_manifest,
                       i.module_topology::text AS module_topology, i.failure_detail, i.version,
                       b.template_id, b.template_version, b.template_digest, i.updated_at
                FROM project p JOIN project_initialization i USING(project_id)
                JOIN template_binding b USING(project_id) WHERE p.project_id = ?
                """, projectId);
    }

    public void approve(String projectId, String reviewer, String comments, String reviewId,
                        String baselineId, String contentHash, String idempotencyKey) {
        Map<String, Object> project = project(projectId);
        jdbc.update("""
                INSERT INTO review_record(review_id, scope_type, scope_id, stage_type, baseline_candidate_ref,
                    source_revision, reviewer_identity, reviewer_role, separation_policy, decision, comments,
                    reviewed_at, idempotency_key)
                VALUES (?, 'PROJECT', ?, 'INITIALIZATION', ?, ?, ?, 'REVIEWER', 'ENFORCED',
                    'APPROVED', ?, now(), ?)
                """, reviewId, projectId, "initialization:" + projectId, project.get("initial_git_revision"),
                reviewer, comments, idempotencyKey);
        jdbc.update("""
                INSERT INTO baseline(baseline_id, scope_type, scope_id, baseline_type, artifact_version,
                    content_hash, source_revision, review_record_id, validity_status)
                VALUES (?, 'PROJECT', ?, 'INITIALIZATION', 1, ?, ?, ?, 'VALID')
                """, baselineId, projectId, contentHash, project.get("initial_git_revision"), reviewId);
        jdbc.update("UPDATE project_initialization SET state='APPROVED', version=version+1, updated_at=now() WHERE project_id=?", projectId);
        jdbc.update("UPDATE run SET status='SUCCEEDED' WHERE run_id=?", runId(projectId));
    }

    private String runId(String projectId) {
        return jdbc.queryForObject("SELECT run_id FROM project_initialization WHERE project_id=?", String.class, projectId);
    }
}
