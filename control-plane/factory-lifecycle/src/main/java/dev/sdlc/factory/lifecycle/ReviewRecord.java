package dev.sdlc.factory.lifecycle;

import dev.sdlc.factory.common.ContractViolationException;
import dev.sdlc.factory.contracts.shared.StageType;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 审核记录（v1.2 §10.4，与 DDL review_record 一致）。
 *
 * <p>紧凑构造器内置两条不变量校验：</p>
 * <ol>
 *   <li>职责分离：ENFORCED 时审核人不能等于主要执行人；
 *       CU 级 CODING/TESTING 必须声明主要执行人；</li>
 *   <li>单操作员豁免：必须携带非空理由，不允许系统静默自批。</li>
 * </ol>
 *
 * @param reviewId           审核 ID
 * @param scope              作用域（含阶段类型）
 * @param baselineCandidateRef 基线候选引用
 * @param artifactHashes     产物内容哈希列表
 * @param sourceRevision     源码修订（可选）
 * @param reviewerIdentity   审核人稳定身份
 * @param reviewerRole       审核人角色
 * @param primaryExecutorId  主要执行人（可选）
 * @param separationPolicy   职责分离策略
 * @param exceptionReason    豁免理由（仅豁免时必填）
 * @param decision           审核决定
 * @param comments           审核意见
 * @param reviewedAt         审核时间
 * @param idempotencyKey     幂等键
 */
public record ReviewRecord(
        String reviewId,
        StageScope scope,
        String baselineCandidateRef,
        List<String> artifactHashes,
        String sourceRevision,
        String reviewerIdentity,
        ReviewerRole reviewerRole,
        String primaryExecutorId,
        SeparationPolicy separationPolicy,
        String exceptionReason,
        ReviewDecision decision,
        String comments,
        Instant reviewedAt,
        String idempotencyKey) {

    public ReviewRecord {
        Objects.requireNonNull(reviewId, "reviewId 不能为空");
        Objects.requireNonNull(scope, "scope 不能为空");
        Objects.requireNonNull(baselineCandidateRef, "baselineCandidateRef 不能为空");
        Objects.requireNonNull(reviewerIdentity, "reviewerIdentity 不能为空");
        Objects.requireNonNull(reviewerRole, "reviewerRole 不能为空");
        Objects.requireNonNull(separationPolicy, "separationPolicy 不能为空");
        Objects.requireNonNull(decision, "decision 不能为空");
        Objects.requireNonNull(comments, "comments 不能为空");
        Objects.requireNonNull(reviewedAt, "reviewedAt 不能为空");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey 不能为空");
        artifactHashes = artifactHashes == null ? List.of() : List.copyOf(artifactHashes);

        // CU 级编码/测试审核必须声明主要执行人（对应 DDL chk_review_stage_scope）
        boolean cuExecutionStage = scope.stageType() == StageType.CODING
                || scope.stageType() == StageType.TESTING;
        if (cuExecutionStage && (primaryExecutorId == null || primaryExecutorId.isBlank())) {
            throw new ContractViolationException("CU 级 CODING/TESTING 审核必须声明主要执行人");
        }

        // 职责分离与单操作员豁免校验（对应 DDL chk_review_separation）
        switch (separationPolicy) {
            case ENFORCED -> {
                if (primaryExecutorId != null && reviewerIdentity.equals(primaryExecutorId)) {
                    throw new ContractViolationException(
                            "职责分离：审核人不能同时是同一阶段的主要执行人（%s）".formatted(reviewerIdentity));
                }
            }
            case SINGLE_OPERATOR_EXCEPTION -> {
                if (primaryExecutorId == null || exceptionReason == null || exceptionReason.isBlank()) {
                    throw new ContractViolationException(
                            "单操作员豁免必须声明主要执行人并记录非空理由");
                }
            }
        }
    }
}
