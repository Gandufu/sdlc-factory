package dev.sdlc.factory.app.host;

import dev.sdlc.factory.common.ContentHash;
import dev.sdlc.factory.contracts.invocation.AgentInvocation;
import dev.sdlc.factory.contracts.invocation.ContentRef;
import dev.sdlc.factory.contracts.invocation.HostAdapterBinding;
import dev.sdlc.factory.contracts.invocation.MessageRole;
import dev.sdlc.factory.contracts.invocation.OutputContract;
import dev.sdlc.factory.contracts.invocation.RenderedMessage;
import dev.sdlc.factory.runner.ProjectRunner;
import dev.sdlc.factory.runner.RunnerCommand;
import dev.sdlc.factory.runner.RunnerOutput;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpenCodeProcessAdapterTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void shouldSendFormalInvocationThroughStandardInputAndReadStructuredResponse() throws Exception {
        Path adapterRoot = Files.createDirectories(temporaryDirectory.resolve("adapter"));
        Path bridge = adapterRoot.resolve("dist/src/factory-bridge.js");
        Files.createDirectories(bridge.getParent());
        Files.writeString(bridge, "// test bridge");
        Path contractsRoot = Files.createDirectories(temporaryDirectory.resolve("contracts"));
        AtomicReference<RunnerCommand> captured = new AtomicReference<>();
        ProjectRunner runner = command -> {
            captured.set(command);
            return new RunnerOutput(0, responseJson(), "", false);
        };
        var json = JsonMapper.builder()
                .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .findAndAddModules().build();
        OpenCodeProcessAdapter adapter = new OpenCodeProcessAdapter(
                runner, json, adapterRoot, contractsRoot, Duration.ofSeconds(30));

        OpenCodeBridgeResponse response = adapter.invoke(invocation(), temporaryDirectory);

        assertEquals("INV-TEST", response.invocationId());
        assertEquals("HND-TEST", response.handoff().handoffId());
        assertTrue(captured.get().standardInput().contains("\"invocation_id\":\"INV-TEST\""));
        assertEquals("node", captured.get().arguments().getFirst());
    }

    private static AgentInvocation invocation() {
        String hash = ContentHash.ofSha256("contract").canonical();
        return new AgentInvocation("1.0", "INV-TEST", "RUN-TEST", "ATT-TEST",
                new HostAdapterBinding("opencode-node", "0.1.0", "1.18.14", "1.18.14"),
                "acceptance", new ContentRef("database:context/CTX-TEST", hash),
                List.of(new RenderedMessage(MessageRole.USER, "acceptance")),
                new OutputContract("handoff", "1.0.0", hash, 1), Instant.parse("2026-08-06T00:00:00Z"));
    }

    private static String responseJson() {
        return """
                {"protocol_version":"1.0","invocation_id":"INV-TEST",
                 "model_ref":"openai/gpt-5.6-luna#max","host_version":"1.18.14","sdk_version":"1.18.14",
                 "host_session_id":"SES-TEST","finish":"stop",
                 "usage":{"input_tokens":10,"output_tokens":2,"cost_usd":0,"host_calls":1},
                 "handoff":{"protocol_version":"1.0","handoff_id":"HND-TEST","run_id":"RUN-TEST",
                   "role":"CODER","summary":"accepted","observations":[],"declared_changed_paths":[],
                   "validations":[],"open_issues":[],"submitted_at":"2026-08-06T00:00:00Z"}}
                """;
    }
}
