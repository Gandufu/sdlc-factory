package dev.sdlc.factory.contracts.lease;

/** 就绪状态（runtime-lease.schema.json: readiness_status）。 */
public enum ReadinessStatus {
    STARTING,
    READY,
    DEGRADED,
    FAILED,
    STOPPED
}
