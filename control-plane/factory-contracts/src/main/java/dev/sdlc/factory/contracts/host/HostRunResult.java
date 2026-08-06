package dev.sdlc.factory.contracts.host;

import java.time.Instant;
import java.util.Objects;

/**
 * 宿主运行结果（host-run-result.schema.json）。
 *
 * <p>合同条件约束：SUCCEEDED 必须携带 handoffRef（成功必绑交接单）；
 * FAILED/TIMED_OUT/BLOCKED 必须携带 errorRef。
 * 宿主报告 finish=tool-calls 但无有效结构化对象时，Adapter 必须转为失败，不得报成功。</p>
 *
 * @param resultId      HRS- 标识
 * @param runId         关联 Run
 * @param invocationId  关联调用 INV-
 * @param hostSessionId 宿主会话 ID
 * @param status        结果状态
 * @param handoffRef    交接单引用（成功必填）
 * @param errorRef      错误信封引用（失败态必填）
 * @param usage         用量
 * @param completedAt   完成时间
 */
public record HostRunResult(
        String resultId,
        String runId,
        String invocationId,
        String hostSessionId,
        HostResultStatus status,
        String handoffRef,
        String errorRef,
        HostUsage usage,
        Instant completedAt) {

    public HostRunResult {
        Objects.requireNonNull(resultId, "resultId 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(invocationId, "invocationId 不能为空");
        Objects.requireNonNull(hostSessionId, "hostSessionId 不能为空");
        Objects.requireNonNull(status, "status 不能为空");
        Objects.requireNonNull(usage, "usage 不能为空");
        Objects.requireNonNull(completedAt, "completedAt 不能为空");
        if (status == HostResultStatus.SUCCEEDED && (handoffRef == null || handoffRef.isBlank())) {
            throw new dev.sdlc.factory.common.ContractViolationException("SUCCEEDED 必须携带 handoff_ref");
        }
        boolean failure = status == HostResultStatus.FAILED
                || status == HostResultStatus.TIMED_OUT
                || status == HostResultStatus.BLOCKED;
        if (failure && (errorRef == null || errorRef.isBlank())) {
            throw new dev.sdlc.factory.common.ContractViolationException("失败态必须携带 error_ref");
        }
    }
}
