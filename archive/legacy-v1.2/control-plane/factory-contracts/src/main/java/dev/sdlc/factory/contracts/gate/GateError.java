package dev.sdlc.factory.contracts.gate;

import java.util.Objects;

/**
 * 门禁拒绝原因（gate-result.schema.json: $defs/error）。
 *
 * @param code      错误码
 * @param message   可读原因
 * @param retryable 是否可重试
 */
public record GateError(String code, String message, boolean retryable) {

    public GateError {
        Objects.requireNonNull(code, "code 不能为空");
        Objects.requireNonNull(message, "message 不能为空");
    }
}
