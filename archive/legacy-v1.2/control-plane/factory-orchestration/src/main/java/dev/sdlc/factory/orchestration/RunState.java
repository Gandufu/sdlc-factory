package dev.sdlc.factory.orchestration;

/**
 * Run 状态（与 DDL run.status CHECK 约束完全一致）。
 *
 * <p>QUEUED_FOR_CAPACITY 是正常排队状态：不计入失败、不消耗重试预算
 * （v1.2 不变量 20）。</p>
 */
public enum RunState {
    QUEUED_FOR_CAPACITY,
    RUNNING,
    SUCCEEDED,
    FAILED,
    BLOCKED,
    CANCELLED,
    TIMED_OUT,
    NEEDS_REVIEW
}
