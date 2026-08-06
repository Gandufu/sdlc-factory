package dev.sdlc.factory.orchestration;

/**
 * 容量裁决（sealed）：要么获得活动执行权，要么进入容量等待队列。
 *
 * <p>使用密封接口让调用方以模式匹配处理两种结果，
 * 编译期保证不会遗漏分支。</p>
 */
public sealed interface CapacityDecision permits Admitted, QueuedForCapacity {

    /** 被裁决的 Run ID。 */
    String runId();
}
