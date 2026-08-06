package dev.sdlc.factory.lifecycle.command;

import java.util.Objects;

/**
 * 外部挂起：Running / Validating → OnHold。
 *
 * @param reason 挂起原因（missing_device、awaiting_clarification 等）
 */
public record ExternalHold(String reason) implements LifecycleCommand {

    public ExternalHold {
        Objects.requireNonNull(reason, "挂起命令必须携带原因");
        if (reason.isBlank()) {
            throw new IllegalArgumentException("挂起原因不能为空串");
        }
    }
}
