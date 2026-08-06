package dev.sdlc.factory.app.host;

import dev.sdlc.factory.contracts.invocation.AgentInvocation;
import dev.sdlc.factory.runner.ProjectRunner;
import dev.sdlc.factory.runner.RunnerCommand;
import dev.sdlc.factory.runner.RunnerOutput;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Java 控制平面到独立 Node/TypeScript OpenCode Host Adapter 的进程接缝。
 * SDK 类型、Session 生命周期和模型响应不会越过该接缝进入 Java Core。
 */
public final class OpenCodeProcessAdapter {

    private final ProjectRunner runner;
    private final ObjectMapper json;
    private final Path adapterRoot;
    private final Path contractsRoot;
    private final Duration timeout;

    public OpenCodeProcessAdapter(ProjectRunner runner, ObjectMapper json, Path adapterRoot,
                                  Path contractsRoot, Duration timeout) {
        this.runner = runner;
        this.json = json;
        this.adapterRoot = adapterRoot.toAbsolutePath().normalize();
        this.contractsRoot = contractsRoot.toAbsolutePath().normalize();
        this.timeout = timeout;
    }

    public OpenCodeBridgeResponse invoke(AgentInvocation invocation, Path projectDirectory) {
        Path bridge = adapterRoot.resolve("dist/src/factory-bridge.js");
        if (!Files.isRegularFile(bridge)) {
            throw new IllegalStateException("OpenCode Bridge 尚未构建：" + bridge);
        }
        RunnerCommand command = new RunnerCommand(
                List.of("node", bridge.toString(),
                        "--directory", projectDirectory.toAbsolutePath().normalize().toString(),
                        "--contracts-root", contractsRoot.toString()),
                adapterRoot,
                Map.of(),
                timeout,
                json.writeValueAsString(invocation));
        RunnerOutput output = runner.execute(command);
        if (output.timedOut()) throw new IllegalStateException("OpenCode Bridge 执行超时");
        if (output.exitCode() != 0) {
            throw new IllegalStateException("OpenCode Bridge 执行失败：" + sanitized(output.stderr()));
        }
        OpenCodeBridgeResponse response = json.readValue(output.stdout().trim(), OpenCodeBridgeResponse.class);
        if (!invocation.invocationId().equals(response.invocationId())) {
            throw new IllegalStateException("OpenCode Bridge 返回了错误的 invocation_id");
        }
        return response;
    }

    private static String sanitized(String stderr) {
        String singleLine = stderr.replaceAll("[\\r\\n]+", " ").trim();
        return singleLine.length() <= 500 ? singleLine : singleLine.substring(0, 500);
    }
}
