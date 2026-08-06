package dev.sdlc.factory.contracts.invocation;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 智能体调用请求（agent-invocation.schema.json）。
 *
 * <p>由 Prompt Builder 完成版本绑定与 Prompt 构造后交给 Stage Agent Adapter；
 * Adapter 不读取资料、不选择上下文、不拼接 Prompt（v1.2 不变量 16/17）。</p>
 *
 * @param protocolVersion    协议版本，固定 1.0
 * @param invocationId       INV- 标识
 * @param runId              关联 Run
 * @param attemptId          关联尝试 ATT-
 * @param hostAdapter        宿主适配器版本绑定
 * @param objective          调用目标
 * @param contextManifestRef 上下文清单引用
 * @param renderedMessages   已渲染消息（至少一条）
 * @param outputContract     结构化输出合同
 * @param createdAt          创建时间
 */
public record AgentInvocation(
        String protocolVersion,
        String invocationId,
        String runId,
        String attemptId,
        HostAdapterBinding hostAdapter,
        String objective,
        ContentRef contextManifestRef,
        List<RenderedMessage> renderedMessages,
        OutputContract outputContract,
        Instant createdAt) {

    public AgentInvocation {
        Objects.requireNonNull(protocolVersion, "protocolVersion 不能为空");
        Objects.requireNonNull(invocationId, "invocationId 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(attemptId, "attemptId 不能为空");
        Objects.requireNonNull(hostAdapter, "hostAdapter 不能为空");
        Objects.requireNonNull(objective, "objective 不能为空");
        Objects.requireNonNull(contextManifestRef, "contextManifestRef 不能为空");
        Objects.requireNonNull(outputContract, "outputContract 不能为空");
        Objects.requireNonNull(createdAt, "createdAt 不能为空");
        if (!"1.0".equals(protocolVersion)) {
            throw new dev.sdlc.factory.common.ContractViolationException("protocol_version 必须为 1.0");
        }
        renderedMessages = renderedMessages == null ? List.of() : List.copyOf(renderedMessages);
        if (renderedMessages.isEmpty()) {
            throw new dev.sdlc.factory.common.ContractViolationException("调用必须至少包含一条渲染消息");
        }
    }
}
