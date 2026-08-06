package dev.sdlc.factory.contracts.gate;

import dev.sdlc.factory.contracts.shared.ScopeType;
import dev.sdlc.factory.contracts.shared.StageType;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 门禁命令（gate-command.schema.json）。
 *
 * <p>操作人员批准或退回阶段的正式命令。expected_version 用于乐观并发控制，
 * idempotencyKey 防止重复提交。</p>
 *
 * @param commandId      GCM- 标识
 * @param idempotencyKey 幂等键
 * @param expectedVersion 期望的阶段版本号
 * @param actor          审核人稳定身份标识
 * @param scopeType      作用域类型
 * @param scopeId        作用域 ID
 * @param stageType      阶段类型
 * @param action         批准或退回
 * @param candidateRef   待审基线候选引用
 * @param evidenceRefs   证据引用（至少一个）
 * @param comments       审核意见（可选）
 * @param issuedAt       签发时间
 */
public record GateCommand(
        String commandId,
        String idempotencyKey,
        int expectedVersion,
        String actor,
        ScopeType scopeType,
        String scopeId,
        StageType stageType,
        GateAction action,
        String candidateRef,
        List<String> evidenceRefs,
        String comments,
        Instant issuedAt) {

    public GateCommand {
        Objects.requireNonNull(commandId, "commandId 不能为空");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey 不能为空");
        Objects.requireNonNull(actor, "actor 不能为空");
        Objects.requireNonNull(scopeType, "scopeType 不能为空");
        Objects.requireNonNull(scopeId, "scopeId 不能为空");
        Objects.requireNonNull(stageType, "stageType 不能为空");
        Objects.requireNonNull(action, "action 不能为空");
        Objects.requireNonNull(candidateRef, "candidateRef 不能为空");
        Objects.requireNonNull(issuedAt, "issuedAt 不能为空");
        if (expectedVersion < 0) {
            throw new dev.sdlc.factory.common.ContractViolationException("expected_version 不能为负数");
        }
        if (actor.isBlank()) {
            throw new dev.sdlc.factory.common.ContractViolationException("actor 不能为空串");
        }
        evidenceRefs = evidenceRefs == null ? List.of() : List.copyOf(evidenceRefs);
        if (evidenceRefs.isEmpty()) {
            throw new dev.sdlc.factory.common.ContractViolationException("门禁命令必须至少引用一个证据");
        }
    }
}
