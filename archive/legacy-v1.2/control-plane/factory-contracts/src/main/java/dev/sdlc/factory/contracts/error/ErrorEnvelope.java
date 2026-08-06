package dev.sdlc.factory.contracts.error;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * 错误信封（error-envelope.schema.json）。
 *
 * <p>所有跨边界错误必须以该结构化信封传递，禁止从聊天文本或日志猜测错误。
 * fingerprint 为 sha256 错误指纹，用于“相同失败停止自动重试”规则；
 * sanitized 恒为 true，表示输出已完成脱敏。</p>
 *
 * @param errorId     错误 ID（ERR- 前缀）
 * @param runId       关联 Run（RUN- 前缀）
 * @param source      错误来源
 * @param category    错误分类
 * @param code        机器可读错误码，如 STRUCTURED_OUTPUT_INVALID
 * @param message     可读消息
 * @param retryable   是否允许纳入统一重试预算
 * @param fingerprint 错误指纹 sha256:...
 * @param sanitized   脱敏标志，合同要求恒为 true
 * @param details     可选结构化细节
 * @param occurredAt  发生时间（UTC）
 */
public record ErrorEnvelope(
        String errorId,
        String runId,
        ErrorSource source,
        ErrorCategory category,
        String code,
        String message,
        boolean retryable,
        String fingerprint,
        boolean sanitized,
        Map<String, Object> details,
        Instant occurredAt) {

    public ErrorEnvelope {
        Objects.requireNonNull(errorId, "errorId 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(source, "source 不能为空");
        Objects.requireNonNull(category, "category 不能为空");
        Objects.requireNonNull(code, "code 不能为空");
        Objects.requireNonNull(message, "message 不能为空");
        Objects.requireNonNull(fingerprint, "fingerprint 不能为空");
        Objects.requireNonNull(occurredAt, "occurredAt 不能为空");
        if (!errorId.matches("^ERR-[A-Z0-9][A-Z0-9-]*$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法 error_id：" + errorId);
        }
        if (!runId.matches("^RUN-[A-Z0-9][A-Z0-9-]*$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法 run_id：" + runId);
        }
        if (!code.matches("^[A-Z][A-Z0-9_]*$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法错误码：" + code);
        }
        if (!fingerprint.matches("^sha256:[a-f0-9]{64}$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法错误指纹：" + fingerprint);
        }
        if (!sanitized) {
            throw new dev.sdlc.factory.common.ContractViolationException("ErrorEnvelope 必须已脱敏（sanitized=true）");
        }
        // 防御性拷贝，保持 record 不可变语义
        details = details == null ? Map.of() : Map.copyOf(details);
    }
}
