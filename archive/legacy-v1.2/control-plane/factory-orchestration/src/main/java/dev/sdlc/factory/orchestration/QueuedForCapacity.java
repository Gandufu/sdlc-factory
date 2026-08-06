package dev.sdlc.factory.orchestration;

import java.util.Objects;

/**
 * 等待容量：Run 进入 QUEUED_FOR_CAPACITY，不计失败、不消耗重试预算。
 *
 * @param runId         排队的 Run
 * @param queuePosition 当前队列位置（1 起，仅用于观测展示）
 */
public record QueuedForCapacity(String runId, int queuePosition) implements CapacityDecision {

    public QueuedForCapacity {
        Objects.requireNonNull(runId, "runId 不能为空");
        if (queuePosition < 1) {
            throw new IllegalArgumentException("queuePosition 必须 >= 1");
        }
    }
}
