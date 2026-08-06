package dev.sdlc.factory.persistence;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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

    public void saveRuntimeCycle(String projectId, String runtimeId, long processId, int port, String cleanupHash) {
        String runId = runId(projectId);
        jdbc.update("""
                INSERT INTO runtime_lease(runtime_id, owner_run_id, process_handles, endpoints, allocated_ports,
                    started_at, readiness_status, lease_expires_at, cleanup_token_hash)
                VALUES (?, ?, ?::jsonb, ?::jsonb, ?::jsonb, now(), 'STOPPED', now(), ?)
                """, runtimeId, runId, "[" + processId + "]",
                "{\"http\":\"http://127.0.0.1:" + port + "\"}", "[" + port + "]", cleanupHash);
        for (String operation : List.of("START", "READINESS", "STOP")) {
            jdbc.update("""
                    INSERT INTO execution_result(execution_id, run_id, operation, operation_status, exit_code,
                        runtime_id, payload, started_at, completed_at)
                    VALUES (?, ?, ?, 'SUCCEEDED', 0, ?, ?::jsonb, now(), now())
                    """, generatedId("EXE"), runId, operation, runtimeId,
                    "{\"process_id\":" + processId + ",\"port\":" + port + "}");
        }
    }

    public List<Map<String, Object>> initializationOperations(String projectId) {
        String runId = runId(projectId);
        List<Map<String, Object>> results = new ArrayList<>(jdbc.queryForList("""
                SELECT operation, operation_status AS status, test_outcome, exit_code,
                       runtime_id, payload::text AS payload, started_at, completed_at
                FROM execution_result WHERE run_id = ?
                ORDER BY CASE operation WHEN 'INSTANTIATE' THEN 1 WHEN 'COMPILE' THEN 2 WHEN 'BUILD' THEN 3
                    WHEN 'TEST' THEN 4 WHEN 'START' THEN 5 WHEN 'READINESS' THEN 6 WHEN 'STOP' THEN 7 ELSE 99 END
                """, runId));
        java.util.Set<String> formal = results.stream()
                .map(row -> row.get("operation").toString()).collect(java.util.stream.Collectors.toSet());
        for (Map<String, Object> evidence : jdbc.queryForList(
                "SELECT storage_ref, content_hash, produced_at FROM evidence WHERE run_id = ? ORDER BY produced_at", runId)) {
            String filename = java.nio.file.Path.of(evidence.get("storage_ref").toString()).getFileName().toString();
            String operation = filename.replaceFirst("\\.log$", "").toUpperCase(Locale.ROOT);
            if (!formal.contains(operation) && !"RUNTIME_CYCLE".equals(operation)) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("operation", operation);
                row.put("status", "SUCCEEDED");
                row.put("content_hash", evidence.get("content_hash"));
                row.put("completed_at", evidence.get("produced_at"));
                results.add(row);
            }
        }
        results.sort(java.util.Comparator.comparingInt(row -> operationOrder(row.get("operation").toString())));
        return results;
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

    /** 运行中心只读投影；展示状态由数据库 Run 状态确定，客户端不得改写。 */
    public List<Map<String, Object>> runBoard() {
        return jdbc.queryForList("""
                SELECT r.run_id, r.project_id, p.name AS project_name,
                       COALESCE(r.cu_id, 'PROJECT') AS scope, r.status AS authoritative_status,
                       CASE r.status
                           WHEN 'QUEUED_FOR_CAPACITY' THEN 'READY'
                           WHEN 'RUNNING' THEN 'RUNNING'
                           WHEN 'NEEDS_REVIEW' THEN 'WAITING_FOR_HUMAN'
                           WHEN 'BLOCKED' THEN 'BLOCKED'
                           WHEN 'FAILED' THEN 'BLOCKED'
                           WHEN 'TIMED_OUT' THEN 'BLOCKED'
                           ELSE 'COMPLETED'
                       END AS lane, r.created_at
                FROM run r JOIN project p USING(project_id)
                ORDER BY r.created_at DESC, r.run_id
                LIMIT 100
                """);
    }

    /** 由待审核、阻塞和已停止自动重试的权威事实派生待处理事项。 */
    public List<Map<String, Object>> attentionItems() {
        return jdbc.queryForList("""
                SELECT 'ATT-INIT-REVIEW-' || i.project_id AS attention_id, i.project_id,
                       i.run_id, '项目初始化' AS scope, 'REVIEW' AS category,
                       '初始化等待人工审核' AS title,
                       '核对模板、Git 修订和执行证据后形成初始化基线。' AS summary,
                       i.updated_at AS occurred_at, 'INITIALIZATION' AS target_type,
                       i.project_id AS target_id
                FROM project_initialization i WHERE i.state = 'AWAITING_REVIEW'
                UNION ALL
                SELECT 'ATT-INIT-FAILED-' || i.project_id, i.project_id, i.run_id,
                       '项目初始化', 'INTERVENTION', '初始化执行失败',
                       COALESCE(NULLIF(i.failure_detail, ''), '控制平面未提供失败详情。'),
                       i.updated_at, 'INITIALIZATION', i.project_id
                FROM project_initialization i WHERE i.state = 'FAILED'
                UNION ALL
                SELECT 'ATT-RUN-' || r.run_id, r.project_id, r.run_id,
                       COALESCE(r.cu_id, '项目级运行'),
                       CASE WHEN r.status = 'BLOCKED' THEN 'BLOCKED' ELSE 'INTERVENTION' END,
                       CASE WHEN r.status = 'BLOCKED' THEN 'Run 已阻塞' ELSE 'Run 已停止自动重试' END,
                       '权威状态：' || r.status || '。进入 Run 上下文查看失败证据。',
                       r.created_at, 'RUN', r.run_id
                FROM run r
                WHERE r.status IN ('BLOCKED','FAILED','TIMED_OUT')
                  AND NOT EXISTS (SELECT 1 FROM project_initialization i WHERE i.run_id = r.run_id)
                ORDER BY occurred_at DESC, attention_id
                """);
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
        jdbc.update("""
                INSERT INTO baseline_item(baseline_id, artifact_type, artifact_ref, content_hash)
                SELECT ?, 'INITIALIZATION_EVIDENCE', evidence_id, content_hash FROM evidence
                WHERE run_id = ?
                """, baselineId, runId(projectId));
        jdbc.update("""
                INSERT INTO baseline_item(baseline_id, artifact_type, artifact_ref, content_hash)
                VALUES (?, 'TEMPLATE_DESCRIPTOR', ?, ?),
                       (?, 'TEMPLATE_PARAMETERS', 'parameters',
                        (SELECT template_parameters_hash FROM project_initialization WHERE project_id = ?)),
                       (?, 'PROJECT_MANIFEST', 'project-manifest', ?)
                """, baselineId, project.get("template_id") + "@" + project.get("template_version"),
                project.get("template_digest"), baselineId, projectId, baselineId, contentHash);
        jdbc.update("""
                INSERT INTO baseline_reference_binding(baseline_id, reference_binding_ref)
                VALUES (?, ?)
                """, baselineId, "template:" + project.get("template_id") + "@"
                + project.get("template_version") + ":" + project.get("template_digest"));
        jdbc.update("UPDATE project_initialization SET state='APPROVED', version=version+1, updated_at=now() WHERE project_id=?", projectId);
        jdbc.update("UPDATE run SET status='SUCCEEDED' WHERE run_id=?", runId(projectId));
    }

    private String runId(String projectId) {
        return jdbc.queryForObject("SELECT run_id FROM project_initialization WHERE project_id=?", String.class, projectId);
    }

    private static String generatedId(String prefix) {
        return prefix + "-" + java.util.UUID.randomUUID().toString().replace("-", "")
                .substring(0, 16).toUpperCase(Locale.ROOT);
    }

    private static int operationOrder(String operation) {
        return switch (operation) {
            case "INSTANTIATE" -> 1;
            case "BOOTSTRAP" -> 2;
            case "VALIDATE" -> 3;
            case "COMPILE" -> 4;
            case "BUILD" -> 5;
            case "TEST" -> 6;
            case "START" -> 7;
            case "READINESS" -> 8;
            case "STOP" -> 9;
            default -> 99;
        };
    }
}
