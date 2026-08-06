package dev.sdlc.factory.app.host;

import dev.sdlc.factory.common.ContentHash;
import dev.sdlc.factory.contracts.host.HostResultStatus;
import dev.sdlc.factory.contracts.host.HostRunResult;
import dev.sdlc.factory.contracts.invocation.AgentInvocation;
import dev.sdlc.factory.contracts.invocation.ContentRef;
import dev.sdlc.factory.contracts.invocation.HostAdapterBinding;
import dev.sdlc.factory.contracts.invocation.MessageRole;
import dev.sdlc.factory.contracts.invocation.OutputContract;
import dev.sdlc.factory.contracts.invocation.RenderedMessage;
import dev.sdlc.factory.persistence.HostAcceptanceRepository;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.transaction.support.TransactionTemplate;

/** 建立 Java Core -> Node OpenCode SDK -> Handoff -> HostRunResult 的最小正式纵切。 */
public final class HostAcceptanceService {

    private static final String HANDOFF_SCHEMA_ID =
            "https://sdlc-factory.local/schemas/v1.2/handoff.schema.json";
    private final HostAcceptanceRepository repository;
    private final OpenCodeProcessAdapter adapter;
    private final ObjectMapper json;
    private final TransactionTemplate transactions;
    private final Path handoffSchema;

    public HostAcceptanceService(HostAcceptanceRepository repository, OpenCodeProcessAdapter adapter,
                                 ObjectMapper json, TransactionTemplate transactions, Path contractsRoot) {
        this.repository = repository;
        this.adapter = adapter;
        this.json = json;
        this.transactions = transactions;
        this.handoffSchema = contractsRoot.resolve("handoff.schema.json");
    }

    public Map<String, Object> execute(String projectId, String objective) {
        if (objective == null || objective.isBlank()) throw new IllegalArgumentException("objective 不能为空");
        Map<String, Object> project = repository.project(projectId);
        Path workspace = Path.of(project.get("workspace_path").toString());
        String runId = id("RUN");
        String attemptId = id("ATT");
        String invocationId = id("INV");
        String manifestId = id("CTX");
        String manifestPayload = json.writeValueAsString(Map.of(
                "purpose", "OPENCODE_HOST_ACCEPTANCE",
                "sources", List.of(),
                "assembled_by", "factory-control-plane"));
        String manifestHash = ContentHash.ofSha256(manifestPayload).canonical();
        String schemaText = readSchema();

        AgentInvocation invocation = new AgentInvocation(
                "1.0", invocationId, runId, attemptId,
                new HostAdapterBinding("opencode-node", "0.1.0", "1.18.14", "1.18.14"),
                objective,
                new ContentRef("database:context_manifest/" + manifestId, manifestHash),
                List.of(
                        new RenderedMessage(MessageRole.SYSTEM,
                                "You are the SDLC Factory OpenCode host acceptance agent. Do not call tools. Return only the required structured Handoff. This run has no authorized evidence references: validations must be empty and declared_changed_paths must be empty."),
                        new RenderedMessage(MessageRole.USER, objective)),
                new OutputContract(HANDOFF_SCHEMA_ID, "1.0.0",
                        ContentHash.ofSha256(schemaText).canonical(), 1),
                Instant.now());
        String invocationPayload = json.writeValueAsString(invocation);
        transactions.executeWithoutResult(ignored -> repository.createInvocation(
                projectId, runId, attemptId, manifestId, manifestPayload, manifestHash,
                invocation, invocationPayload, ContentHash.ofSha256(invocationPayload).canonical()));

        try {
            OpenCodeBridgeResponse response = adapter.invoke(invocation, workspace);
            if (!"1.0".equals(response.protocolVersion()) || !"openai/gpt-5.6-luna#max".equals(response.modelRef())) {
                throw new IllegalStateException("OpenCode Bridge 协议或模型绑定不符合验收要求");
            }
            if (!runId.equals(response.handoff().runId())) {
                throw new IllegalStateException("Handoff 未绑定当前 Run");
            }
            if (!response.handoff().declaredChangedPaths().isEmpty()
                    || response.handoff().validations().stream().anyMatch(item -> !item.evidenceRefs().isEmpty())) {
                throw new IllegalStateException("Handoff 引用了本次验收未授权的变更或证据");
            }
            String handoffPayload = json.writeValueAsString(response.handoff());
            HostRunResult result = new HostRunResult(
                    id("HRS"), runId, invocationId, response.hostSessionId(), HostResultStatus.SUCCEEDED,
                    response.handoff().handoffId(), null, response.usage(), Instant.now());
            transactions.executeWithoutResult(ignored -> repository.complete(
                    response.handoff(), handoffPayload, ContentHash.ofSha256(handoffPayload).canonical(), result));
            Map<String, Object> facts = new java.util.LinkedHashMap<>(repository.result(runId));
            facts.put("model_ref", response.modelRef());
            facts.put("finish", response.finish());
            return facts;
        } catch (RuntimeException exception) {
            persistFailure(runId, invocationId, exception);
            throw new HostExecutionException(runId, exception);
        }
    }

    private void persistFailure(String runId, String invocationId, RuntimeException exception) {
        String errorId = id("ERR");
        String message = exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
        String payload = json.writeValueAsString(Map.of("message", message, "sanitized", true));
        String fingerprint = ContentHash.ofSha256("OPENCODE_BRIDGE_FAILED:" + message).canonical();
        HostRunResult failed = new HostRunResult(
                id("HRS"), runId, invocationId, "unavailable:" + invocationId,
                HostResultStatus.FAILED, null, errorId,
                new dev.sdlc.factory.contracts.host.HostUsage(0, 0, 0, 0), Instant.now());
        transactions.executeWithoutResult(ignored -> repository.fail(
                errorId, runId, fingerprint, payload, failed));
    }

    private String readSchema() {
        try {
            return Files.readString(handoffSchema, StandardCharsets.UTF_8);
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("读取 Handoff Schema 失败：" + handoffSchema, exception);
        }
    }

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().replace("-", "")
                .toUpperCase(Locale.ROOT);
    }
}
