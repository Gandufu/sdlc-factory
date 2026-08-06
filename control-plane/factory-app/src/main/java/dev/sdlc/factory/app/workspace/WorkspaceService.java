package dev.sdlc.factory.app.workspace;

import dev.sdlc.factory.app.host.HostAcceptanceService;
import dev.sdlc.factory.app.host.HostExecutionException;
import dev.sdlc.factory.persistence.WorkspaceRepository;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** 组合项目会话、Run、Gate、证据和基线的应用服务。 */
public final class WorkspaceService {

    private final WorkspaceRepository repository;
    private final HostAcceptanceService host;
    private final TransactionTemplate transactions;

    public WorkspaceService(WorkspaceRepository repository, HostAcceptanceService host,
                            TransactionTemplate transactions) {
        this.repository = repository;
        this.host = host;
        this.transactions = transactions;
    }

    public Map<String, Object> workspace(String projectId) {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> project = repository.project(projectId);
        List<Map<String, Object>> sessions = repository.sessions(projectId).stream().map(this::sessionSummary).toList();
        result.put("project", project);
        result.put("lifecycle", lifecycle(projectId, project));
        result.put("sessions", sessions);
        result.put("attention_count", repository.gates(projectId).stream()
                .filter(gate -> "WAITING".equals(gate.get("status"))).count());
        result.put("gates", repository.gates(projectId).stream().map(this::gateProjection).toList());
        result.put("baselines", repository.baselines(projectId));
        result.put("configuration", configuration(projectId));
        return result;
    }

    public Map<String, Object> session(String projectId, String sessionId) {
        Map<String, Object> result = new LinkedHashMap<>(repository.session(projectId, sessionId));
        List<Map<String, Object>> runs = repository.sessionRuns(sessionId);
        result.put("run_ids", runs.stream().map(run -> run.get("run_id")).toList());
        result.put("runs", runs);
        result.put("messages", repository.messages(sessionId));
        result.put("artifacts", repository.artifacts(sessionId));
        result.put("gates", repository.gates(projectId).stream()
                .filter(gate -> sessionId.equals(gate.get("session_id"))).map(this::gateProjection).toList());
        return result;
    }

    public Map<String, Object> createSession(String projectId, String parentSessionId,
                                             String agent, String title) {
        repository.project(projectId);
        String sessionId = id("SES");
        String safeAgent = require(agent, "agent");
        String safeTitle = require(title, "title");
        transactions.executeWithoutResult(ignored -> {
            repository.createSession(projectId, sessionId, parentSessionId, safeAgent, safeTitle);
            repository.addMessage(sessionId, id("MSG"), "SYSTEM",
                    "Factory 会话已创建。每次发送消息都会形成新的不可变 Run 边界。", null);
        });
        return session(projectId, sessionId);
    }

    public Map<String, Object> archive(String projectId, String sessionId) {
        repository.archiveSession(projectId, sessionId);
        return session(projectId, sessionId);
    }

    public Map<String, Object> send(String projectId, String sessionId, String content) {
        Map<String, Object> current = repository.session(projectId, sessionId);
        if (Boolean.TRUE.equals(current.get("archived")) || !Boolean.TRUE.equals(current.get("current"))
                || !"ACTIVE".equals(current.get("state"))) {
            throw new IllegalStateException("只有 ACTIVE 的当前未归档会话可以发送消息");
        }
        String message = require(content, "content");
        repository.addMessage(sessionId, id("MSG"), "OPERATOR", message, null);
        String transcript = repository.messages(sessionId).stream()
                .map(item -> item.get("role") + ": " + item.get("content"))
                .reduce((left, right) -> left + "\n\n" + right).orElse(message);
        try {
            Map<String, Object> facts = host.execute(projectId,
                    "延续 Factory 会话并返回结构化 Handoff。以下是权威会话记录：\n\n" + transcript);
            String runId = facts.get("run_id").toString();
            String handoffId = facts.get("handoff_id").toString();
            transactions.executeWithoutResult(ignored -> {
                repository.linkRun(sessionId, runId, "WAITING");
                repository.addMessage(sessionId, id("MSG"), "AGENT",
                        facts.get("handoff_payload").toString(), runId);
                repository.createGate(projectId, sessionId, runId, id("GAT"), handoffId);
            });
        } catch (HostExecutionException exception) {
            transactions.executeWithoutResult(ignored -> {
                repository.linkRun(sessionId, exception.runId(), "BLOCKED");
                repository.addMessage(sessionId, id("MSG"), "SYSTEM",
                        "Run 执行失败并已停止自动重试：" + exception.getMessage(), exception.runId());
            });
            throw exception;
        }
        return session(projectId, sessionId);
    }

    public Map<String, Object> decide(String projectId, String gateId, String reviewer,
                                      String comments, String idempotencyKey, int expectedVersion,
                                      boolean approve) {
        repository.decideGate(projectId, gateId, require(reviewer, "reviewer_identity"),
                require(comments, "comments"), require(idempotencyKey, "idempotency_key"),
                expectedVersion, approve, id("REV"), approve ? id("BSL") : null);
        return workspace(projectId);
    }

    public Map<String, Object> recover(String projectId, String sessionId, String oldRunId) {
        Map<String, Object> oldRun = repository.sessionRuns(sessionId).stream()
                .filter(run -> oldRunId.equals(run.get("run_id"))).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("旧 Run 不属于当前会话"));
        if (!List.of("BLOCKED", "FAILED", "TIMED_OUT").contains(oldRun.get("status"))) {
            throw new IllegalStateException("只有阻塞或失败终态 Run 可以复检恢复");
        }
        return send(projectId, sessionId,
                "已完成阻塞复检。保持旧 Run " + oldRunId + " 的终态，创建新 Run 继续执行。");
    }

    private Map<String, Object> sessionSummary(Map<String, Object> row) {
        Map<String, Object> summary = new LinkedHashMap<>(row);
        String runIds = row.get("run_ids").toString();
        summary.put("run_ids", runIds.isBlank() ? List.of() : List.of(runIds.split(",")));
        return summary;
    }

    private Map<String, Object> gateProjection(Map<String, Object> gate) {
        Map<String, Object> projection = new LinkedHashMap<>(gate);
        String runId = gate.get("run_id").toString();
        projection.put("candidate_artifacts", gate.get("handoff_id") == null ? List.of() : List.of(Map.of(
                "artifact_id", gate.get("handoff_id"), "artifact_type", "HANDOFF",
                "artifact_ref", gate.get("candidate_ref"), "content_hash", gate.get("candidate_content_hash"))));
        projection.put("handoff", gate.get("handoff_id") == null ? null : Map.of(
                "handoff_id", gate.get("handoff_id"), "payload", gate.get("handoff_payload")));
        projection.put("deterministic_checks", repository.checks(runId));
        projection.put("environment_bindings", List.of());
        projection.put("open_questions", List.of());
        projection.put("evidence", repository.evidence(runId));
        return projection;
    }

    private List<Map<String, Object>> lifecycle(String projectId, Map<String, Object> project) {
        List<String> complete = new ArrayList<>();
        if ("APPROVED".equals(project.get("initialization_state"))) complete.add("INITIALIZATION");
        for (Map<String, Object> baseline : repository.baselines(projectId)) {
            complete.add(baseline.get("baseline_type").toString());
        }
        boolean hasRun = repository.sessions(projectId).stream()
                .anyMatch(session -> !session.get("run_ids").toString().isBlank());
        return List.of("INITIALIZATION", "REQUIREMENT", "DESIGN", "CODING", "TESTING", "SYSTEM_ACCEPTANCE")
                .stream().map(stage -> Map.<String, Object>of(
                        "stage", stage,
                        "status", complete.contains(stage) ? "COMPLETED"
                                : "CODING".equals(stage) && hasRun ? "ACTIVE" : "PENDING"))
                .toList();
    }

    private Map<String, Object> configuration(String projectId) {
        return Map.of(
                "agents", List.of(),
                "runtime_bindings", repository.observedRuntimeBindings(projectId),
                "skills", List.of(), "mcp", List.of(), "plugins", List.of(),
                "permission_policy", "OpenCode Bridge 当前固定 deny-all tools",
                "health", "SUPPORTED_READ_ONLY");
    }

    private static String require(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " 不能为空");
        return value.trim();
    }

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 20).toUpperCase(Locale.ROOT);
    }
}
