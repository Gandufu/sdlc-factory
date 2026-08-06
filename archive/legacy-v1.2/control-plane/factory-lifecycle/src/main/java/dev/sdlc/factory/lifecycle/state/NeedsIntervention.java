package dev.sdlc.factory.lifecycle.state;

import java.util.Objects;

/**
 * 需人工介入态：重试预算耗尽、重复错误、宿主故障等。
 *
 * <p>系统只探测并标记恢复条件，恢复必须由操作人员确认后创建新运行。</p>
 *
 * @param reason 介入原因
 */
public record NeedsIntervention(String reason) implements LifecycleState {

    public NeedsIntervention {
        Objects.requireNonNull(reason, "人工介入必须携带原因");
        if (reason.isBlank()) {
            throw new IllegalArgumentException("介入原因不能为空串");
        }
    }

    @Override
    public String name() {
        return "NEEDS_INTERVENTION";
    }
}
