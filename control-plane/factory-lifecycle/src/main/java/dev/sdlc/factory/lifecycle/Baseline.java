package dev.sdlc.factory.lifecycle;

import dev.sdlc.factory.common.ContractViolationException;
import dev.sdlc.factory.contracts.shared.ScopeType;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 基线（v1.2 §6.1）。
 *
 * <p>基线不是单文件指针，而是一组不可变条目；批准后不得原地修改，
 * 任何新内容都产生新的产物版本和基线。作用域约束：
 * Initialization/Requirement/Design/SystemAcceptance 使用 PROJECT，
 * Code/Test 使用 CAPABILITY_UNIT。</p>
 *
 * @param baselineId     基线 ID
 * @param scopeType      作用域类型
 * @param scopeId        作用域 ID
 * @param baselineType   基线类型
 * @param artifactVersion 产物版本（>0）
 * @param contentHash    基线整体内容哈希
 * @param sourceRevision 源码修订（可选）
 * @param items          基线条目
 * @param reviewRecordId 批准的审核记录
 * @param signatureRef   签名/存证引用（预留，可选）
 * @param validityStatus 有效性
 * @param createdAt      创建时间
 */
public record Baseline(
        String baselineId,
        ScopeType scopeType,
        String scopeId,
        BaselineType baselineType,
        int artifactVersion,
        String contentHash,
        String sourceRevision,
        List<ArtifactRef> items,
        String reviewRecordId,
        String signatureRef,
        ValidityStatus validityStatus,
        Instant createdAt) {

    public Baseline {
        Objects.requireNonNull(baselineId, "baselineId 不能为空");
        Objects.requireNonNull(scopeType, "scopeType 不能为空");
        Objects.requireNonNull(scopeId, "scopeId 不能为空");
        Objects.requireNonNull(baselineType, "baselineType 不能为空");
        Objects.requireNonNull(contentHash, "contentHash 不能为空");
        Objects.requireNonNull(reviewRecordId, "reviewRecordId 不能为空");
        Objects.requireNonNull(validityStatus, "validityStatus 不能为空");
        Objects.requireNonNull(createdAt, "createdAt 不能为空");
        if (artifactVersion <= 0) {
            throw new ContractViolationException("artifact_version 必须为正数");
        }
        items = items == null ? List.of() : List.copyOf(items);

        // 基线类型与作用域的合法组合（对应 DDL chk_baseline_type_scope）
        boolean projectType = baselineType == BaselineType.INITIALIZATION
                || baselineType == BaselineType.REQUIREMENT
                || baselineType == BaselineType.DESIGN
                || baselineType == BaselineType.SYSTEM_ACCEPTANCE;
        boolean cuType = baselineType == BaselineType.CODE || baselineType == BaselineType.TEST;
        if (projectType && scopeType != ScopeType.PROJECT) {
            throw new ContractViolationException(baselineType + " 基线必须作用于 PROJECT");
        }
        if (cuType && scopeType != ScopeType.CAPABILITY_UNIT) {
            throw new ContractViolationException(baselineType + " 基线必须作用于 CAPABILITY_UNIT");
        }
    }

    /**
     * 派生失效副本：上游变化时将本基线标记为 STALE 或需影响复核。
     * 基线不可原地修改，因此返回携带新有效性的新实例，其余字段完全不变。
     */
    public Baseline invalidate(ValidityStatus newStatus) {
        Objects.requireNonNull(newStatus, "newStatus 不能为空");
        if (newStatus == ValidityStatus.VALID) {
            throw new ContractViolationException("invalidate 不允许把基线恢复为 VALID，请创建新基线");
        }
        return new Baseline(baselineId, scopeType, scopeId, baselineType, artifactVersion,
                contentHash, sourceRevision, items, reviewRecordId, signatureRef,
                newStatus, createdAt);
    }
}
