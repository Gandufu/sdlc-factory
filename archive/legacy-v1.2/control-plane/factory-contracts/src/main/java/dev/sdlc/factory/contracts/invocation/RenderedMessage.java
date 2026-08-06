package dev.sdlc.factory.contracts.invocation;

import java.util.Objects;

/**
 * 已渲染消息（agent-invocation.schema.json: rendered_messages 元素）。
 *
 * <p>消息由 Prompt Builder 用版本化模板构造；
 * Stage Agent Adapter 只消费，不再选择资料或拼接 Prompt。</p>
 *
 * @param role    角色
 * @param content 内容
 */
public record RenderedMessage(MessageRole role, String content) {

    public RenderedMessage {
        Objects.requireNonNull(role, "role 不能为空");
        Objects.requireNonNull(content, "content 不能为空");
        if (content.isBlank()) {
            throw new dev.sdlc.factory.common.ContractViolationException("消息内容不能为空串");
        }
    }
}
