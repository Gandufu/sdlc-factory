package dev.sdlc.factory.contracts.shared;

/**
 * 操作状态（机器合同字段 operation_status）。
 *
 * <p>compile/build/start/stop 等确定性操作共用；
 * 测试步骤在此之外额外携带 {@link TestOutcome}。</p>
 */
public enum OperationStatus {
    SUCCEEDED,
    FAILED,
    CANCELLED,
    TIMED_OUT,
    BLOCKED
}
