package dev.sdlc.factory.orchestration;

import java.util.Objects;

/**
 * 获得活动执行权：Run 立即进入 RUNNING。
 *
 * @param runId 被接纳的 Run
 */
public record Admitted(String runId) implements CapacityDecision {

    public Admitted {
        Objects.requireNonNull(runId, "runId 不能为空");
    }
}
