package dev.sdlc.factory.lifecycle.command;

import java.util.Objects;

/**
 * 执行失败：Running → NeedsIntervention。
 *
 * @param reason 失败原因（retry_budget_exceeded、repeated_error 等）
 */
public record ExecutionFailure(String reason) implements LifecycleCommand {

    public ExecutionFailure {
        Objects.requireNonNull(reason, "失败命令必须携带原因");
        if (reason.isBlank()) {
            throw new IllegalArgumentException("失败原因不能为空串");
        }
    }
}
