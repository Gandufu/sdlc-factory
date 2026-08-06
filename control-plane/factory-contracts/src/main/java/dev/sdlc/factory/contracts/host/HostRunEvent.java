package dev.sdlc.factory.contracts.host;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * 宿主运行事件（host-run-event.schema.json）。
 *
 * <p>Host Adapter 把 OpenCode/Codex 事件转换为该标准事件；
 * payload 必须携带 sanitized=true，其余字段按事件类型附加。</p>
 *
 * @param eventId       HEV- 标识
 * @param runId         关联 Run
 * @param invocationId  关联调用 INV-
 * @param hostSessionId 宿主会话 ID
 * @param sequence      事件序号（从 0 单调递增）
 * @param eventType     事件类型
 * @param occurredAt    发生时间
 * @param payload       事件负载（必须含 sanitized=true）
 */
public record HostRunEvent(
        String eventId,
        String runId,
        String invocationId,
        String hostSessionId,
        long sequence,
        HostEventType eventType,
        Instant occurredAt,
        Map<String, Object> payload) {

    public HostRunEvent {
        Objects.requireNonNull(eventId, "eventId 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(invocationId, "invocationId 不能为空");
        Objects.requireNonNull(hostSessionId, "hostSessionId 不能为空");
        Objects.requireNonNull(eventType, "eventType 不能为空");
        Objects.requireNonNull(occurredAt, "occurredAt 不能为空");
        Objects.requireNonNull(payload, "payload 不能为空");
        if (sequence < 0) {
            throw new dev.sdlc.factory.common.ContractViolationException("sequence 不能为负数");
        }
        if (!Boolean.TRUE.equals(payload.get("sanitized"))) {
            throw new dev.sdlc.factory.common.ContractViolationException("宿主事件 payload 必须已脱敏");
        }
        payload = Map.copyOf(payload);
    }
}
