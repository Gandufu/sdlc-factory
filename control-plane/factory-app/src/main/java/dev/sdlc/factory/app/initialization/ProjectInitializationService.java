package dev.sdlc.factory.app.initialization;

import dev.sdlc.factory.common.ContentHash;
import dev.sdlc.factory.persistence.ProjectInitializationRepository;
import dev.sdlc.factory.runner.RunnerOutput;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 模板选择、生成、验证、审核之间的唯一应用编排入口。 */
public final class ProjectInitializationService {

    private final ProjectInitializationRepository repository;
    private final NodeTemplateAdapter template;
    private final TransactionTemplate transactions;
    public ProjectInitializationService(ProjectInitializationRepository repository, NodeTemplateAdapter template,
                                        TransactionTemplate transactions) {
        this.repository = repository;
        this.template = template;
        this.transactions = transactions;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void registerBuiltInTemplate() {
        repository.registerTemplate(NodeTemplateAdapter.ID, NodeTemplateAdapter.VERSION,
                "builtin:node-basic", template.digest());
    }

    public List<Map<String, Object>> templates() {
        return repository.activeTemplates();
    }

    public List<Map<String, Object>> projects() {
        return repository.projects();
    }

    public Map<String, Object> project(String projectId) {
        Map<String, Object> detail = new java.util.LinkedHashMap<>(repository.project(projectId));
        detail.put("operations", repository.initializationOperations(projectId));
        return detail;
    }

    public Map<String, Object> initialize(String name, String workspacePath, String templateId, String templateVersion) {
        requireText(name, "project_name");
        requireText(workspacePath, "workspace_path");
        Map<String, Object> registration = repository.activeTemplate(templateId, templateVersion);
        if (!template.digest().equals(registration.get("digest"))) {
            throw new IllegalStateException("模板摘要与内置实现不一致，拒绝执行");
        }
        Path workspace = resolveWorkspace(workspacePath);
        if (Files.exists(workspace)) throw new IllegalArgumentException("目标目录已存在：" + workspace);

        String projectId = id("PRJ");
        String runId = id("RUN");
        String parameterHash = ContentHash.ofSha256(name + "\n" + workspace).canonical();
        transactions.executeWithoutResult(ignored -> repository.createProject(projectId, name, runId,
                workspace.toString(), parameterHash, templateId, templateVersion, template.digest()));

        try {
            repository.updateState(projectId, "INSTANTIATING", null);
            template.instantiate(workspace, name);
            saveTextEvidence(projectId, "INSTANTIATE", workspace, "generated project files");

            RunnerOutput bootstrap = template.requireSuccess("bootstrap", template.bootstrap(workspace));
            saveTextEvidence(projectId, "BOOTSTRAP", workspace, bootstrap.stdout() + bootstrap.stderr());
            String revision = template.revision(workspace);
            repository.updateState(projectId, "VALIDATING", null);

            for (Map.Entry<String, RunnerOutput> entry : template.validate(workspace).entrySet()) {
                String operation = entry.getKey();
                RunnerOutput output = entry.getValue();
                String log = output.stdout() + output.stderr();
                Path evidence = writeEvidence(workspace, operation, log);
                String hash = ContentHash.ofSha256(log).canonical();
                template.requireSuccess(operation, output);
                if (List.of("COMPILE", "BUILD", "TEST").contains(operation)) {
                    repository.saveEvidence(projectId, id("EVD"), id("EXE"), operation, evidence.toString(),
                            hash, log.getBytes(StandardCharsets.UTF_8).length, output.exitCode(),
                            "{\"template_operation\":\"" + operation + "\"}");
                } else if ("RUNTIME_CYCLE".equals(operation)) {
                    NodeTemplateAdapter.RuntimeCycleResult runtime = template.runtimeCycleResult(output);
                    repository.saveEvidenceOnly(projectId, id("EVD"), evidence.toString(), hash,
                            log.getBytes(StandardCharsets.UTF_8).length);
                    repository.saveRuntimeCycle(projectId, id("RTM"), runtime.processId(), runtime.port(),
                            ContentHash.ofSha256(projectId + ":" + runtime.processId()).canonical());
                } else {
                    repository.saveEvidenceOnly(projectId, id("EVD"), evidence.toString(), hash,
                            log.getBytes(StandardCharsets.UTF_8).length);
                }
            }
            String manifest = "{\"project_id\":\"" + projectId + "\",\"template_id\":\"" + templateId
                    + "\",\"template_version\":\"" + templateVersion + "\"}";
            repository.completeValidation(projectId, revision, manifest);
            return repository.project(projectId);
        } catch (Exception failure) {
            repository.updateState(projectId, "FAILED", safeMessage(failure));
            throw new IllegalStateException("项目初始化失败，已保留恢复证据：" + projectId, failure);
        }
    }

    static Path resolveWorkspace(String workspacePath) {
        final Path candidate;
        try {
            candidate = Path.of(workspacePath);
        } catch (java.nio.file.InvalidPathException exception) {
            throw new IllegalArgumentException("workspace_path 不是有效路径", exception);
        }
        if (!candidate.isAbsolute()) {
            throw new IllegalArgumentException("workspace_path 必须是绝对路径，例如 D:\\workspace\\my-project");
        }
        Path normalized = candidate.normalize();
        if (normalized.getParent() == null) {
            throw new IllegalArgumentException("workspace_path 不能是文件系统根目录");
        }
        return normalized;
    }

    public Map<String, Object> approve(String projectId, String reviewer, String comments, String idempotencyKey) {
        requireText(reviewer, "reviewer_identity");
        requireText(comments, "comments");
        requireText(idempotencyKey, "idempotency_key");
        Map<String, Object> current = repository.project(projectId);
        if (!"AWAITING_REVIEW".equals(current.get("state"))) {
            throw new IllegalStateException("只有 AWAITING_REVIEW 状态可批准");
        }
        String contentHash = ContentHash.ofSha256(current.toString()).canonical();
        transactions.executeWithoutResult(ignored -> repository.approve(projectId, reviewer, comments,
                id("REV"), id("BLN"), contentHash, idempotencyKey));
        return project(projectId);
    }

    private void saveTextEvidence(String projectId, String operation, Path workspace, String content) throws IOException {
        Path evidence = writeEvidence(workspace, operation, content);
        repository.saveEvidenceOnly(projectId, id("EVD"), evidence.toString(),
                ContentHash.ofSha256(content).canonical(), content.getBytes(StandardCharsets.UTF_8).length);
    }

    private Path writeEvidence(Path workspace, String operation, String content) throws IOException {
        Path target = workspace.resolve(".factory/evidence/" + operation.toLowerCase() + ".log");
        Files.writeString(target, content);
        return target;
    }

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " 不能为空");
    }

    private static String safeMessage(Exception failure) {
        String message = failure.getMessage() == null ? failure.getClass().getSimpleName() : failure.getMessage();
        return message.length() > 1000 ? message.substring(0, 1000) : message;
    }
}
