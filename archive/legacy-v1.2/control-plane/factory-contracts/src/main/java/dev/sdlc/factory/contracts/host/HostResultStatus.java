package dev.sdlc.factory.contracts.host;

/** 宿主运行结果状态（host-run-result.schema.json: status）。 */
public enum HostResultStatus {
    SUCCEEDED,
    FAILED,
    CANCELLED,
    TIMED_OUT,
    BLOCKED
}
