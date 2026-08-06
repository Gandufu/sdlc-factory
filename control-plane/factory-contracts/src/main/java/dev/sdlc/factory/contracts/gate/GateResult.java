package dev.sdlc.factory.contracts.gate;

import java.time.Instant;
import java.util.Objects;

/**
 * 门禁结果（gate-result.schema.json）。
 *
 * <p>合同条件约束：APPLIED 必须携带 reviewRecordRef；REJECTED 必须携带 error。
 * 该约束在紧凑构造器中强制。</p>
 *
 * @param resultId       GRS- 标识
 * @param commandId      对应门禁命令 GCM-
 * @param outcome        结果
 * @param actualVersion  事务提交后的实际阶段版本
 * @param reviewRecordRef 审核记录引用（APPLIED 必填）
 * @param baselineRef    形成的基线引用（可选）
 * @param error          拒绝原因（REJECTED 必填）
 * @param decidedAt      裁决时间
 */
public record GateResult(
        String resultId,
        String commandId,
        GateOutcome outcome,
        int actualVersion,
        String reviewRecordRef,
        String baselineRef,
        GateError error,
        Instant decidedAt) {

    public GateResult {
        Objects.requireNonNull(resultId, "resultId 不能为空");
        Objects.requireNonNull(commandId, "commandId 不能为空");
        Objects.requireNonNull(outcome, "outcome 不能为空");
        Objects.requireNonNull(decidedAt, "decidedAt 不能为空");
        if (actualVersion < 0) {
            throw new dev.sdlc.factory.common.ContractViolationException("actual_version 不能为负数");
        }
        if (outcome == GateOutcome.APPLIED && (reviewRecordRef == null || reviewRecordRef.isBlank())) {
            throw new dev.sdlc.factory.common.ContractViolationException("APPLIED 结果必须携带 review_record_ref");
        }
        if (outcome == GateOutcome.REJECTED && error == null) {
            throw new dev.sdlc.factory.common.ContractViolationException("REJECTED 结果必须携带 error");
        }
    }
}
